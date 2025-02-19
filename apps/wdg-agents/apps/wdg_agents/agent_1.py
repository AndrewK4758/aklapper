import os
from typing import TypedDict
from rich.console import Console

from dotenv import load_dotenv
from langchain_community.tools.tavily_search.tool import TavilySearchResults
from langchain_community.utilities.tavily_search import TavilySearchAPIWrapper
from langchain_ollama import ChatOllama

from langchain.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
from langgraph.graph import END, StateGraph

from langchain_chroma import Chroma
from langchain.chains.combine_documents import create_stuff_documents_chain

x = load_dotenv(dotenv_path="apps/wdg_agents/env/.env")


def get_tavily_api_key() -> str:
    try:
        key = os.getenv('TAVILY_API_KEY', "")
        return key
    except KeyError as e:
        key = f"Tavily API Key not found. Please assign or add to .env file:\n\t{e}"
        return key


TAVILY_API_KEY = get_tavily_api_key()
rich = Console()


str_format = StrOutputParser()
json_format = JsonOutputParser()

# -----------------GENERATE PROMPT-------------------#

generate_prompt = PromptTemplate(
    template="""
    
    <|begin_of_text|>
    
    <|start_header_id|>system<|end_header_id|> 
    
    You are an AI assistant for Research Question Tasks, that synthesizes web search results. 
    Strictly use the following pieces of web search context to answer the question. If you don't know the answer, just say that you don't know. 
    keep the answer concise, but provide all of the details you can in the form of a research report. 
    Only make direct references to material if provided in the context.
    
    <|eot_id|>
    
    <|start_header_id|>user<|end_header_id|>
    
    Question: {question} 
    Web Search Context: {context} 
    Answer: 
    <|eot_id|>
    
    <|start_header_id|>assistant<|end_header_id|>""",
    input_variables=["question", "context"],
)

# ----------------ROUTER PROMPT------------------#

router_prompt = PromptTemplate(
    template="""
    
    <|begin_of_text|>
    
    <|start_header_id|>system<|end_header_id|>
    
    You are an expert at routing a user question to either the final_response stage or web search. 
    Use the web search for questions that require more context for a better answer, or recent events.
    Otherwise, you can skip and go straight to the final_response phase to respond.
    You do not need to be stringent with the keywords in the question related to these topics.
    Give a binary choice 'web_search' or 'generate' based on the question. 
    Return the JSON with a single key 'choice' with no premable or explanation. 
    
    Question to route: {question} 
    
    <|eot_id|>
    
    <|start_header_id|>assistant<|end_header_id|>
    
    """,
    input_variables=["question"],
)

# Query Transformation

query_prompt = PromptTemplate(
    template="""
    
    <|begin_of_text|>
    
    <|start_header_id|>system<|end_header_id|> 
    
    You are an expert at crafting web search queries for research questions.
    More often than not, a user will ask a basic question that they wish to learn more about, however it might not be in the best format. 
    Reword their query to be the most effective web search string possible.
    Return the JSON with a single key 'query' with no premable or explanation. 
    
    Question to transform: {question} 
    
    <|eot_id|>
    
    <|start_header_id|>assistant<|end_header_id|>
    
    """,
    input_variables=["question"],
)

tavily_client = TavilySearchAPIWrapper(tavily_api_key=TAVILY_API_KEY)  # type: ignore
tavily_tool = TavilySearchResults(api_wrapper=tavily_client, max_results=25)

# Graph State - Starting Point


class GraphState(TypedDict):
    """
    Represents the state of the graph.

    Attributes:
      question: question
      final_response: LLM final_response
      web_search_query: question in web search format
      context: web_search_query result
    """
    question: str
    final_response: str
    web_search_query: str
    context: str

# Graph Node - Generate - Final Step


def generate(state):
    """
    Generate answer

    Args:
        state (dict): The current graph state

    Returns:
        state (dict): New key added to state, final_response, that contains LLM final_response
    """

    print("Step: Generating Final Response")
    question = state["question"]
    context = state["context"]

    formatted_generate_prompt = generate_prompt.invoke({"question": question, "context": context})

    generate_response = llama.invoke(formatted_generate_prompt)

    formatted_generate_response = str_format.invoke(input=generate_response)

    return {"final_response": formatted_generate_response}

# Graph Node - Web Search Query - Step 2 (If needed)


def transform_query(state):
    """
    Transform user question to web search

    Args:
        state (dict): The current graph state

    Returns:
        state (dict): Appended search query
    """

    print("Step: Optimizing Query for Web Search")
    question = state['question']

    formatted_transform_query = query_prompt.invoke({"question": question})

    query_response = llama_json.invoke(formatted_transform_query)

    formatted_transform_query_response = json_format.invoke(query_response)

    search_query = formatted_transform_query_response["query"]

    return {"web_search_query": search_query}


def web_search(state):
    """
    Web search based on the question

    Args:
        state (dict): The current graph state

    Returns:
        state (dict): Appended web results to context
    """

    search_query = state['web_search_query']

    print(f'Step: Searching the Web for: "{search_query}"')

    search_result = tavily_tool.invoke(search_query)

    return {"context": search_result}


def route_question(state):
    """
    route question to web search or final_response.

    Args:
        state (dict): The current graph state

    Returns:
        str: Next node to call
    """

    print("Step: Routing Query")
    question = state['question']

    formatted_router_prompt = router_prompt.invoke({"question": question})

    router_response = llama_json.invoke(formatted_router_prompt)

    formatted_router_response = json_format.invoke(router_response)

    if formatted_router_response['choice'] == "web_search":
        print("Step: Routing Query to Web Search")
        return "websearch"
    elif formatted_router_response['choice'] == 'generate':
        print("Step: Routing Query to Generation")
        return "generate"


workflow_graph = StateGraph(GraphState)
workflow_graph.add_node("websearch", web_search)
workflow_graph.add_node("transform_query", transform_query)
workflow_graph.add_node("generate", generate)

workflow_graph.set_conditional_entry_point(
    route_question,
    {
        "websearch": "transform_query",
        "generate": "generate"
    }
)

workflow_graph.add_edge("transform_query", "websearch")
workflow_graph.add_edge("websearch", "generate")
workflow_graph.add_edge("generate", END)

local_agent = workflow_graph.compile()


async def query_agent(model: str, query: str, db: Chroma) -> str:
    global llama
    global llama_json
    llama = ChatOllama(model=model, temperature=0)
    llama_json = ChatOllama(model=model, format='json', temperature=0)

    retriever = db.as_retriever(
        search_type="mmr",
        search_kwargs={
            "k": 5,
            "lambda_mult": 0.25,
        }
    )

    print("RETRIEVER: ", retriever, '\n')
    test = await retriever.ainvoke(query)
    print("TEST: ", test, '\n')

    chain = create_stuff_documents_chain(llm=llama, prompt=generate_prompt)
    print("CHAIN: ", chain, '\n')
    output = local_agent.invoke({"question": query, "context": test})
    return output["final_response"] + '\n'
