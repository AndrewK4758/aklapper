import os

from dotenv import load_dotenv
from langchain.agents import AgentExecutor, create_react_agent
from langchain_core.prompts import ChatPromptTemplate
from langchain.prompts.chat import AIMessagePromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate
from langchain_core.tools import Tool
from langchain_google_community.search import GoogleSearchAPIWrapper, GoogleSearchRun
from langchain_ollama import ChatOllama

load_dotenv(dotenv_path="apps/wdg_agents/env/.env")

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GOOGLE_CSE_ID = os.getenv("GOOGLE_CSE_ID")

google_search_api = GoogleSearchAPIWrapper(google_api_key=GOOGLE_API_KEY, google_cse_id=GOOGLE_CSE_ID, k=10)

VERBOSE_MODE = os.getenv("VERBOSE_MODE", "False").lower() == "true"

search = GoogleSearchRun(
    name="google web search",
    description="google web search for current data, context, and results",
    api_wrapper=google_search_api,
    verbose=VERBOSE_MODE,
    response_format="content",
    num_results=10,
)


def web_search(query: str):
    try:
        return search.invoke(query)
    except Exception as e:
        print(f"Error during web search: {e}")
        return "An error occurred while performing the web search."


web_search_tool = Tool(
    name="web search",
    description="Searches the web to retrieve the most relevant and up-to-date information for a query.",
    func=web_search,
)

tools = [web_search_tool]

tool_names = [web_search_tool.name]

print(tool_names)


def use_local_llm(model, query):

    local_model = ChatOllama(name='local chatbot with websearch agent', model=model, verbose=VERBOSE_MODE)

    system_prompt = """You are a helpful AI assistant that can search the internet. Use the available 
    tools to answer queries.  

        Available tools: {tool_names}
        Tools: {tools}
                
        Your reasoning process should follow these steps:
        - Thought: Decide the next action or search step.
        - Action: Select a tool from {tool_names}.
        - Action Input: Provide input for the selected tool.
        - Observation: Note the tool’s output.
        - Final Answer: Provide a complete and accurate answer based on your observations.

        {agent_scratchpad}
        """

    system_messages = SystemMessagePromptTemplate.from_template(template=system_prompt)

    print('SYSTEM MESSAGES: ', system_messages, '\nn')

    human_messages = HumanMessagePromptTemplate.from_template("{input}")

    print('HUMAN MESSAGES: ', human_messages, '\nn')

    ai_messages = AIMessagePromptTemplate.from_template("{agent_scratchpad}")

    print('AI MESSAGES: ', ai_messages, '\nn')

    chat_prompt = ChatPromptTemplate.from_messages([
        system_messages,
        human_messages,
        ai_messages
    ])

    print('CHAT PROMPT: ', chat_prompt.pretty_print(), '\nn')
#######################################################
# Not sure how to tie this into the chat_prompt
    chat_prompt.format(
        tools=tools,
        tool_names=tool_names,
        input=query,
        agent_scratchpad=[]
    )

    # print('PROMPT VALUE: ', prompt_value, '\nn')

    # prompt = prompt_value.to_string()
########################################################
    return local_model, chat_prompt


def use_agent(model: str, query: str):
    local_model, chat_prompt = use_local_llm(model, query)

    agent = create_react_agent(local_model, tools, chat_prompt)

    agent_executor = AgentExecutor(
        name="web_search_agent", agent=agent, tools=tools, verbose=VERBOSE_MODE, handle_parsing_errors=True
    )

    return agent_executor


def use_model_with_agent(model: str, query: str):
    try:
        chain = use_agent(model, query)

        full_input = {
            "input": query,  # The key should match what is used in the system and other prompts in use_local_llm
            "tools": tools,
            "tool_names": tool_names,
            "agent_scratchpad": []
        }

        agent_response = chain.invoke(full_input)

        return agent_response
    except Exception as e:
        print(f"Error in agent execution: {str(e)}")
        return {
            "output": f"An error occurred while processing your request: {str(e)}",
            "error": True
        }
