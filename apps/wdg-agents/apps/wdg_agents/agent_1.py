import os

from dotenv import load_dotenv
from langchain.agents import AgentExecutor, create_react_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import SystemMessage
from langchain_core.tools import Tool
from langchain_google_community import GoogleSearchRun
from langchain_google_community.search import GoogleSearchAPIWrapper, GoogleSearchResults
from langchain_ollama import ChatOllama

load_dotenv(dotenv_path="apps/wdg_agents/env/.env")

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GOOGLE_CSE_ID = os.getenv("GOOGLE_CSE_ID")

google_search_api = GoogleSearchAPIWrapper(google_api_key=GOOGLE_API_KEY, google_cse_id=GOOGLE_CSE_ID, k=10)

search = GoogleSearchRun(
    name="google web search",
    description="google web search for current data, context, and results",
    api_wrapper=google_search_api,
    verbose=True,
    response_format="content",
    num_results=10,
)


def web_search(query: str):
    return search.invoke(query)


web_search = Tool(
    name="web search",
    description="web search for current data, context, and results",
    func=web_search,
)

tools = [web_search]

tool_names = [tool.name for tool in tools]

def use_local_llm(model, query):

    local_model = ChatOllama(name='local chatbot with websearch agent', model=model, verbose=True)

    system_template = """You are a helpful AI assistant that can search the internet. Use the {tool_names} tools to answer querys.

    Question: {query}

    Tools: {tools}
    Tool Names: {tool_names}
    
    Your reasoning pattern follows the steps below. 

    **Thought**: I should reason step by step to determine the answer.
    **Action**: If action is needed, the action to take, should be one of {tool_names}.
    **Action Input**: The input to the action.
    **Observation**: The result of the action.
    **Final Answer**: The final answer to the original query. You MUST return the answer when you have a final answer response. 
    (the steps Thought/Action/Action Input/Observation can be repeated up to 3 times to find the correct answer)

    Example:
    Question: What is the weather in London?
    Thought: I should use the web search tool to find the weather.
    Action: web search  # Exact match
    Action Input: weather in London
    (the steps Thought/Action/Action Input/Observation can be repeated up to 3 times to find the correct answer)
    Observation: [Search results about London weather]

    Final Answer: The weather in London is currently [summary from search results].

    {agent_scratchpad}
     """

    messages =[ 
        ("system", system_template),
        ('human', query),
        ("ai", '{tools}'),
        ("ai", '{tool_names}'),
        ("ai", "{agent_scratchpad}") 
    ]
    
    prompt = ChatPromptTemplate(messages=messages)

    print(prompt.pretty_print())
    return (local_model, prompt)


def use_agent(model: str, query: str):
    (local_model, prompt) = use_local_llm(model, query)

    agent = create_react_agent(local_model, tools, prompt)

    agent_executor = AgentExecutor(
        name="web_search_agent", agent=agent, tools=tools, verbose=True, handle_parsing_errors=True
    )

    return agent_executor

def use_model_with_agent(model: str, query: str):

    chain = use_agent(model, query)

    current_messages = {"query": query, "tools": '{tools}',"tool_names": '{tool_names}', "thought":[], "action":[], "action_input":[],"observation":[], "final_answer":[], "agent_scratchpad": []}

    agent_response = chain.invoke(current_messages)

    return agent_response
    # return (local_model, prompt)
    # resp = chain.invoke({"query":poetry she "What is the best practice for react contex ?"})
    # while True:
    #     print("Query:", end=" ")
    #     try:
    #         inputText = input()
    #     except EOFError:
    #         break
    #     if inputText == "exit" or inputText == "quit":
    #         break
    #     chain = prompt | model
    #     resp = chain.invoke({"prompt": [HumanMessage(content=inputText)]})
    #     print(resp)


# if __name__ == "__main__":
#     main()
