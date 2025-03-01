from typing import TypedDict

# Graph State - Starting Point


class GraphState(TypedDict):
    """
    Represents the state of the graph.

    Attributes:
      question: question
      final_response: LLM final_response
      web_search_query: question in web search format
      context: web_search_query result
      document_context: returned documents from database retriever query
      history: conversation histroy for specific user or context id
    """
    question: str
    final_response: str
    web_search_query: str
    context: str | list[str]
    document_context: str
    history: list[str]
