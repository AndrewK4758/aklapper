import os
from typing import Literal, TypedDict

from dotenv import load_dotenv
from langchain_community.utilities.tavily_search import TavilySearchAPIWrapper
from langchain_community.tools.tavily_search.tool import TavilySearchResults
from langgraph.prebuilt.chat_agent_executor import create_react_agent
from langchain_ollama import ChatOllama

from langchain_core.tools import Tool, tool
from langgraph.graph.message import MessagesState
from langgraph.graph.state import StateGraph, START, END
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import MemorySaver


class AgentState(MessagesState):
    next: str


system_prompt = """You are a helpful AI assistant that can search the internet. Use the available
    tools to answer queries"""

# vectorstore = Chroma(embedding_function=OllamaEmbeddings(model='llama3.2'), persist_directory='./chroma_db_ollama')

load_dotenv(dotenv_path="apps/wdg_agents/env/.env")

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GOOGLE_CSE_ID = os.getenv("GOOGLE_CSE_ID")
TAVILY_API_KEY = os.getenv('TAVILY_API_KEY')
VERBOSE_MODE = os.getenv("VERBOSE_MODE", "False").lower() == "True"

llm = ChatOllama(model='llama3.2:latest', temperature=1)


@tool
def llm_tool(query: str):
    "llm"
    messages = [
        {"role": "system", "content": system_prompt}, {"role": "user", "content": query},
    ]

    response = llm.invoke(messages)

    print(response)
    return {
        "messages": [
            HumanMessage(content=response["messages"][-1].content, name="llm_node")  # type: ignore
        ]
    }


# llm_tool_instance = Tool(
#     name='llm',
#     description='This tool is used to query the llm',
#     func=llm_tool
# )

tavily_client = TavilySearchAPIWrapper()  # type: ignore
tavily_tool = TavilySearchResults(api_wrapper=tavily_client)

llm_agent = create_react_agent(model=llm, tools=[tavily_tool], debug=VERBOSE_MODE, prompt=system_prompt)
# web_search_agent = create_react_agent(model=llm, tools=[

# tavily_tool], prompt='''You are highly trained in searching the internet. You are tasked with finding the answer to
# the users question. Your can use the following tools: Tavily Search''')


# @tool
# def web_search_tool(state: MessagesState):
#     "tool to query the web for web search agent"
#     result = web_search_agent.invoke(state)

#     return {
#         "messages": [
#             HumanMessage(content=result["messages"][-1].content, name='web searcher')
#         ]
#     }


# web_search_tool_instance = Tool(
#     name='web searcher',
#     description='Tool to search the web',
#     func=web_search_tool.invoke
# )

# builder = StateGraph(AgentState)
# builder.add_edge(START, "llm")
# builder.add_node("llm", llm_tool)
# # builder.add_node("web searcher", web_search_tool_instance)

# config = {"configurable": {"thread_id": "1"}}
# memory = MemorySaver()

# # builder.add_edge("llm", "web searcher")

# # builder.add_conditional_edges("llm", lambda state: state["next"])

# graph = builder.compile(checkpointer=memory)


def main():
    while True:
        user_input = input(">> ")
        if user_input.lower() in ["quit", "exit", "q"]:
            print("Goodbye!")
            break

        for s in llm_tool(user_input):
            print(s)
            print("----")


if __name__ == "__main__":
    main()
'''

google_wrapper = GoogleSearchAPIWrapper()
google_search = GoogleSearchResults(api_wrapper=google_wrapper, num_results=3, verbose=True, model_config={
"strict": True,
"revalidate_instances": 'always'
})
g_tool = Tool(
name='Google search tool',
description='Search google and return results',
func=google_search.invoke,
)
# 
result = google_search.invoke('how many gold medals did us win in 2004 olympics', {})
x = result.replace('\\', ' ')
y = x.replace("'", '"')
z = json.loads(y)
print(type(z))
print('\n', z)
# 
x = result.replace("'[", '"[')
y = x.replace("]'", ']"')
replaced = y.replace("'", '"')
# 
print(type(replaced))
print('\n')
json_result = replaced
# 
print(json_result)
print('\n')
data = json.loads(json_result)
# 
for item in data:
    print('\n')
    print(item)
    print('\n')
# 
x = result[0]
y = result[1]
print('\n')
print(type(result))
print('\n')
print(x)
print('\n')
print(y)
# 
# 
def web_search(query: str):
# 
    try:
        return search.run(query)
    except Exception as e:
        print(f"Error during web search: {e}")
        return "An error occurred while performing the web search."
# 
# 
web_search_tool = Tool(
    name="google web search tool",
    description="Searches the web to retrieve the most relevant and up-to-date information for a query.",
    func=web_search,
)
# 
tools = [web_search_tool]
# 
tool_names = [web_search_tool.name]
# 
# 
def use_local_llm(model):
# 
    llm = ChatOllama(name='local chatbot with websearch agent', model=model, verbose=VERBOSE_MODE)
    # llm_with_tools = local_model.bind_tools(tools=web_search_tool)
# 
    system_prompt = """You are a helpful AI assistant that can search the internet. Use the available
    tools to answer queries.
# 
        {query}
# 
        Available tools: {tool_names}
        Tools: {tools}
# 
        Your reasoning process should follow these steps:
        - Thought: Decide the next action or search step.
        - Action: Return one of the available tools in the following format:
      {
          "tool": "tool_name",
          "tool_input": "tool_input"
      }
        - Action messages: Provide messages for the selected tool.
        - Observation: Note the tool’s output.
        - Final Answer: Provide a complete and accurate answer based on your observations.
# 
        {agent_scratchpad}
        """
# 
    return llm, system_prompt
# 
# 
def use_model_with_agent(model: str, query: str):
    llm, system_prompt = use_local_llm(model=model)
# 
    agent = create_react_agent(llm, tools)
# 
    agent_executor = AgentExecutor(name="web search agent", tools=tools, agent=agent,  verbose=True, debug=True,
                                   handle_parsing_errors=True, return_intermediate_steps=True)
# 
    print(agent_executor)
# 
    full_input = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=query)
    ]
# 
    response = agent_executor.invoke({})
# 
    print(response)
    return 'ABCD'

    chat_prompt = ChatPromptTemplate.from_messages([
        ("user", "{messages}"),
        ("placeholder", "{agent_scratchpad}")
    ]
    )

    return local_with_tool, chat_prompt, system_prompt


def use_agent(model: str, query: str):
    local_model, chat_prompt, system_prompt = use_local_llm(model, query)

    agent = create_react_agent(model=local_model, tools=tools, debug=True, state_modifier=system_prompt)

    agent_executor = AgentExecutor(

name="web_search_agent", agent=agent, tools=tools, verbose=VERBOSE_MODE, handle_parsing_errors=True, 
return_intermediate_steps=True
    )

    return agent_executor


def use_model_with_agent(model: str, query: str):
    try:
        chain = use_agent(model, query)

        full_messages = {
            # The key should match what is used in the system and other prompts in use_local_llm
            "messages": [("user", query)],
            "tools": [("ai", tools)],
            "tool_names": [("ai", tool_names)],
            "agent_scratchpad": [("ai", "")]
        }

        agent_response = chain.invoke(full_messages)

        return agent_response
    except Exception as e:
        print(f"Error in agent execution: {str(e)} \n {e.args}")
        return {
            "output": f"An error occurred while processing your request: {str(e)}",
            "error": True
        }
'''
