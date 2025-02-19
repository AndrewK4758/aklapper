import operator
from typing import Annotated, TypedDict, Union
from langchain_core.agents import AgentAction, AgentFinish
from langchain_core.messages import BaseMessage


class AgentState(TypedDict):
    input: str
    messages: Union[AgentAction, AgentFinish, None]
    chat_history: list[BaseMessage]
    intermediate_steps: Annotated[list[tuple[AgentAction, str]], operator.add]


agent_state = {
    "input": "who is the current us president",
    "chat_history": [],
    "agent_outcome": None,
    "intermediate_steps": [(""), operator.add]
}

'''
       - {tools}: A formatted string of tool names and descriptions.
       - {tool_names}: A comma-separated string of tool names.
       - {agent_scratchpad}: A formatted string of previous agent actions and outputs.
        
        Your reasoning process should follow these steps:
        - Thought: Decide the next action or search step.
        - Action: Decide which tool to use if any are needed
        - Action messages: Provide messages for the selected tool.
        - Observation: Note the tool’s output.
        You can repeat the Thought - Observation steps as many times as necessary to find the correct answer
        - Final Answer: Provide a complete and accurate answer based on your observations.
'''
