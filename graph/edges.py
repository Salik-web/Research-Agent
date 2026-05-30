from graph.state import graph_schema


def should_continue(state: graph_schema):
    if state["is_sufficient"] or state["iterations"] >= 3:
        return "human_review"
    return "search_again"


def human_decision(state: graph_schema):
    if state["human_approved"]:
        # If context came from vector DB, no web results to store — go straight to report
        if state.get("context_sufficient", False):
            return "generate_report"
        return "pinecone_store"
    return "search_again"


def check_context_sufficient(state: graph_schema):
    if state.get("context_sufficient", False):
        return "human_review"
    return "web_search"
