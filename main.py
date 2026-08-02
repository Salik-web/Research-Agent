import os
import sqlite3

import groq
from dotenv import load_dotenv
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import StateGraph, END, START
from langgraph.types import RetryPolicy
from graph.state import graph_schema
from graph.nodes import (
    load_documents,
    contextualize_query,
    evaluate_context,
    web_search,
    summarize,
    evaluate,
    human_review,
    pinecone_store,
    retrieve_context,
    generate_report,
    update_messages,
)
from graph.edges import should_continue, human_decision, check_context_sufficient

load_dotenv()


def _is_rate_limit(exc: Exception) -> bool:
    """True for Groq free-tier rate-limit / token-per-minute errors."""
    if isinstance(exc, groq.RateLimitError):
        return True
    if isinstance(exc, groq.APIStatusError) and getattr(exc, "status_code", None) in (413, 429):
        return True
    msg = str(exc).lower()
    return any(
        s in msg
        for s in ("rate_limit", "tokens per minute", "request too large", "tpm")
    )


# On the free tier the 6000 tokens-per-minute budget can be exhausted mid-query.
# When that happens, wait briefly and retry the node once rather than crashing.
# Kept short on purpose: a long backoff (the old 6-attempt / ~4.5-min policy)
# just makes the request hang behind an infinite spinner. With one retry the
# worst case is a single ~5s wait per node; if it still fails, the error
# propagates so the API can return a clear "rate_limited" status to the UI.
LLM_RETRY = RetryPolicy(
    initial_interval=5.0,
    backoff_factor=2.0,
    max_interval=15.0,
    max_attempts=2,
    jitter=True,
    retry_on=_is_rate_limit,
)


def build_graph():
    workflow = StateGraph(graph_schema)

    # Nodes that call the LLM get the rate-limit retry policy.
    workflow.add_node("load_documents", load_documents)
    workflow.add_node("contextualize_query", contextualize_query, retry_policy=LLM_RETRY)
    workflow.add_node("evaluate_context", evaluate_context, retry_policy=LLM_RETRY)
    workflow.add_node("web_search", web_search)
    workflow.add_node("summarize", summarize, retry_policy=LLM_RETRY)
    workflow.add_node("evaluate", evaluate, retry_policy=LLM_RETRY)
    workflow.add_node("human_review", human_review)
    workflow.add_node("pinecone_store", pinecone_store)
    workflow.add_node("retrieve_context", retrieve_context)
    workflow.add_node("generate_report", generate_report, retry_policy=LLM_RETRY)
    workflow.add_node("update_messages", update_messages)

    workflow.add_edge(START, "load_documents")
    workflow.add_edge("load_documents", "contextualize_query")
    workflow.add_edge("contextualize_query", "retrieve_context")
    workflow.add_edge("retrieve_context", "evaluate_context")
    workflow.add_conditional_edges(
        "evaluate_context",
        check_context_sufficient,
        {"human_review": "human_review", "web_search": "web_search"},
    )
    workflow.add_edge("web_search", "summarize")
    workflow.add_edge("summarize", "evaluate")
    workflow.add_conditional_edges(
        "evaluate",
        should_continue,
        {"human_review": "human_review", "search_again": "web_search"},
    )
    workflow.add_conditional_edges(
        "human_review",
        human_decision,
        {"pinecone_store": "pinecone_store", "generate_report": "generate_report", "search_again": "web_search"},
    )
    workflow.add_edge("pinecone_store", "generate_report")
    workflow.add_edge("generate_report", "update_messages")
    workflow.add_edge("update_messages", END)

    # Durable, file-backed memory: each thread_id's state survives restarts,
    # so revisiting an old conversation keeps its history. check_same_thread=False
    # lets uvicorn's worker threads share the one connection.
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "checkpoints.sqlite")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    checkpointer = SqliteSaver(conn)
    checkpointer.setup()
    return workflow.compile(checkpointer=checkpointer, interrupt_before=["human_review"])


if __name__ == "__main__":
    graph = build_graph()
    config = {"configurable": {"thread_id": "session_1"}}

    print("Research Agent Ready!")
    while True:
        query = input("\nEnter research topic (or 'quit'): ")
        if query == "quit":
            break

        result = graph.invoke(
            {"query": query, "iterations": 0, "human_approved": False, "messages": []},
            config=config,
        )

        state = graph.get_state(config)
        if state.next and state.next[0] == "human_review":
            print("\n=== RESEARCH FINDINGS SO FAR ===")
            print(state.values.get("summarized_result", ""))
            print("\nDo you want to:")
            print("1. Generate report with these findings")
            print("2. Search for more information")
            choice = input("Enter 1 or 2: ")
            approved = choice == "1"
            
            graph.update_state(config, {"human_approved": approved})
            result = graph.invoke(None, config)

        print("\n=== FINAL RESEARCH REPORT ===")
        print(result.get("final_report", ""))
