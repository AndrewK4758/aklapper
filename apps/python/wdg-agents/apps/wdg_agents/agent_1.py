import os

from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_community.tools.tavily_search.tool import TavilySearchResults
from langchain_community.utilities.tavily_search import TavilySearchAPIWrapper
from langchain_core.documents import Document
from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
from langchain_ollama import ChatOllama
from langgraph.graph import END
from langgraph.graph.state import StateGraph
from rich.console import Console
from wdg_agents.state import GraphState
from wdg_agents.prompts.agent_1.generate_prompt import generate_prompt
from wdg_agents.prompts.agent_1.query_prompt import query_prompt
from wdg_agents.prompts.agent_1.router_prompt import router_prompt

x = load_dotenv(dotenv_path="apps/wdg_agents/env/.env")


def get_tavily_api_key() -> str:
    try:
        key = os.getenv('TAVILY_API_KEY', "")
        return key
    except KeyError as e:
        key = f"Tavily API Key not found. Please assign or add to .env file: \n\t{e}"
        return key


TAVILY_API_KEY = get_tavily_api_key()
rich = Console()


str_format = StrOutputParser()
json_format = JsonOutputParser()


tavily_client = TavilySearchAPIWrapper(tavily_api_key=TAVILY_API_KEY)  # type: ignore
tavily_tool = TavilySearchResults(api_wrapper=tavily_client, max_results=25)

# Graph Node - Generate - Final Step


def generate(state):
    """
    Generate answer

    Args:
        state (dict): The current graph state

    Returns:
        state (dict): Adds value to state at key: final_response which contains the result of LLM query
    """

    print("Step: Generating Final Response")
    question: str = state["question"]
    context: str = state["context"]
    document_context: str = state["document_context"]
    history: list[str] = state["history"]

    formatted_generate_prompt = generate_prompt.invoke(
        {"question": question, "context": context, "document_context": document_context, "history": history})

    generate_response = llama.invoke(formatted_generate_prompt)

    formatted_generate_response = str_format.invoke(input=generate_response)

    rich.print('STATE BEFORE FINAL RESPONSE: ', state)
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

    Args:0
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
workflow_graph.add_node("generate", generate)
workflow_graph.add_node("transform_query", transform_query)
workflow_graph.add_node("websearch", web_search)

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


def make_history_documents(state: GraphState) -> list[Document]:
    documents = []
    for key in state:
        if key == 'question' or key == 'final_response':
            print(state[key])
            documents.append(Document(page_content=state[key], metadata={"graph_state_key": key}))
    return documents


async def query_agent(model: str, query: str, rag_collection: Chroma, history_collection: Chroma) -> str:
    global llama
    global llama_json
    llama = ChatOllama(model=model, temperature=5)
    llama_json = ChatOllama(model=model, format='json', temperature=5)

    history = history_collection.get(limit=20)
    history_text = history["documents"] if history else []

    state: GraphState = GraphState(
        {"question": query, "context": "", "final_response": "",
            "document_context": "", "web_search_query": "", "history": history_text}
    )

    retriever = rag_collection.as_retriever(
        search_type="mmr",
        search_kwargs={
            "k": 5,
            "fetch_k": 25,
            "lambda_mult": 0.85,
        }
    )

    rag_docs = await retriever.ainvoke(query)

    rag_content = "\n\n".join(doc.page_content for doc in rag_docs)

    state["document_context"] = rag_content if rag_docs else ""

    output = await local_agent.ainvoke(state)

    state['final_response'] = output['final_response']

    await history_collection.aadd_documents(documents=make_history_documents(state))

    return output["final_response"] + '\n'
