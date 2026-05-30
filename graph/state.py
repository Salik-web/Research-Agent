from typing import TypedDict, Annotated, List
from langgraph.graph.message import add_messages


class graph_schema(TypedDict):
    query: str
    messages: Annotated[List, add_messages]
    search_results: List[str]
    summarized_result: List[str]
    retrieved_context: List[str]
    is_sufficient: bool
    context_sufficient: bool
    human_approved: bool
    final_report: str
    iterations: int
