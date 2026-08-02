from graph.state import graph_schema


def should_continue(state: graph_schema):
    # Cap at a single web_search -> summarize -> evaluate loop. Each loop is two
    # Groq calls (summarize + evaluate) against a 6000 TPM budget, so allowing
    # up to 3 loops (the old limit) burned ~6 calls in the worst case and stalled
    # the query. One iteration halves that while still letting the human ask for
    # more via the review step.
    if state["is_sufficient"] or state["iterations"] >= 1:
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
