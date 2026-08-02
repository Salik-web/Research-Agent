from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.messages import HumanMessage, AIMessage
from langchain_groq import ChatGroq
from dotenv import load_dotenv
from graph.state import graph_schema

# Load .env here too, so importing this module works regardless of import
# order (e.g. running main.py directly, where load_dotenv() runs after this
# import). ChatGroq reads GROQ_API_KEY from the environment automatically.
load_dotenv()

# max_tokens caps the reserved output budget. On Groq's free tier the
# per-request token count = prompt tokens + max_tokens, and the TPM limit is
# only 6000, so leaving this unset (large default) overflows the limit.
# streaming=True lets the backend stream report tokens via LangGraph's
# stream_mode="messages" (real ChatGPT-style token streaming).
llm = ChatGroq(
    model="qwen/qwen3-32b",
    max_tokens=2048,
    temperature=0.3,
    streaming=True,
)

# A cheap "judge" client for yes/no decisions (evaluate_context, evaluate).
# These nodes only need one word, so we cap the output budget to a couple of
# tokens: with `/no_think` in the prompt Qwen3 skips its reasoning block and
# emits the answer directly. temperature=0 keeps the verdict deterministic, and
# no streaming avoids the per-chunk overhead. This shaves the reserved output
# tokens per judge call from 2048 to ~4 against the 6000 TPM budget.
judge_llm = ChatGroq(
    model="qwen/qwen3-32b",
    max_tokens=4,
    temperature=0.0,
    streaming=False,
)

# --- Groq call accounting ----------------------------------------------------
# Count every Groq round-trip so the per-query call count is verifiable from the
# logs. load_documents (the first node of every query) resets the counter, so
# the number printed after generate_report is the end-to-end total for that
# query. See README / the latency notes for expected counts.
_groq_calls = 0


def _reset_groq_counter() -> None:
    global _groq_calls
    _groq_calls = 0
    print("[groq] === new query: call counter reset ===", flush=True)


def _log_groq_call(node: str) -> None:
    global _groq_calls
    _groq_calls += 1
    print(f"[groq] call #{_groq_calls} (node={node})", flush=True)


def _strip_think(text: str) -> str:
    """Remove Qwen3 <think>...</think> reasoning from an LLM response."""
    if "</think>" in text:
        text = text.split("</think>")[-1]
    return text.strip()


def _truncate(value, max_chars: int) -> str:
    """Flatten a value to text and cap its length to stay under the TPM limit."""
    text = "\n\n".join(str(v) for v in value) if isinstance(value, list) else str(value)
    if len(text) > max_chars:
        return text[:max_chars] + "\n...[truncated]"
    return text


# Conversation memory window: keep the last N exchanges (a user message + an
# assistant reply = one exchange). Old assistant reports are long, so they're
# clipped to a short snippet in the transcript — enough for context, cheap on
# tokens. User questions are kept (clipped only if very long).
HISTORY_MAX_TURNS = 4
_HISTORY_USER_CHARS = 600
_HISTORY_ASSISTANT_CHARS = 400


def _clip(text, max_chars: int) -> str:
    text = str(text or "")
    return text if len(text) <= max_chars else text[:max_chars].rstrip() + " …"


def _format_history(messages, max_turns: int = HISTORY_MAX_TURNS) -> str:
    """Render the last `max_turns` exchanges as a compact transcript.

    Keeps the most RECENT turns (not the oldest), and trims long assistant
    reports to a snippet so memory stays relevant and within the token budget.
    """
    msgs = [m for m in (messages or []) if getattr(m, "content", "")]
    msgs = msgs[-(max_turns * 2):]  # ~2 messages per exchange
    lines = []
    for m in msgs:
        role = getattr(m, "type", "")
        if role in ("human", "user"):
            lines.append(f"User: {_clip(m.content, _HISTORY_USER_CHARS)}")
        else:
            lines.append(f"Assistant: {_clip(m.content, _HISTORY_ASSISTANT_CHARS)}")
    return "\n".join(lines)


def contextualize_query(state: graph_schema):
    """
    Rewrite a follow-up question into a standalone query using the prior
    conversation, so downstream retrieval and web search are meaningful.

    On the first turn (no history) the query is left unchanged.
    """
    history = _format_history(state.get("messages", []))
    if not history:
        return {}

    prompt = f"""You are given a conversation history and the user's latest message.
Rewrite the latest message into a single, standalone question that can be
understood on its own, without the history. Resolve any references like
"it", "that", "the first one", etc. using the history.
If the latest message is already standalone, return it unchanged.
Output ONLY the rewritten question, nothing else. /no_think

Conversation history:
{history}

Latest message: {state["query"]}

Standalone question:"""

    _log_groq_call("contextualize_query")
    response = llm.invoke(prompt)
    rewritten = _strip_think(response.content).strip().strip('"')
    if rewritten:
        return {"query": rewritten}
    return {}


def evaluate_context(state: graph_schema):
    prompt = f"""
    Query: {state["query"]}
    Retrieved context from internal documents: {_truncate(state.get("retrieved_context", ""), 3000)}

    Does the provided context contain the specific information required to accurately and fully answer the user's query?
    Ignore your prior knowledge and base your decision ONLY on whether the text above contains the answer.
    Answer only: yes or no /no_think
    """
    _log_groq_call("evaluate_context")
    response = judge_llm.invoke(prompt)
    is_sufficient = "yes" in _strip_think(response.content).lower()

    result = {"context_sufficient": is_sufficient}
    if is_sufficient:
        context = state.get("retrieved_context", [])
        context_text = "\n\n".join(context) if isinstance(context, list) else str(context)
        result["summarized_result"] = (
            "**Found relevant context in internal documents:**\n\n" + context_text
        )
    return result


def load_documents(state: graph_schema):
    from vectorstore.pinecone_store import is_index_empty, get_vectorstore

    # First node of every query -> reset the per-query Groq call counter.
    _reset_groq_counter()

    if is_index_empty():
        print("\n=== INGESTING PDFS TO PINECONE ===")
        loader = PyPDFDirectoryLoader("./documents")
        docs = loader.load()
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
        )
        chunks = splitter.split_documents(docs)
        vectorstore = get_vectorstore()
        vectorstore.add_documents(chunks)
    else:
        print("\n=== PINECONE INDEX ALREADY POPULATED ===")

    return {}


def web_search(state: graph_schema):
    from tools.tools import tavily_search

    results = tavily_search(state["query"])
    return {"search_results": results, "iterations": state["iterations"] + 1}


def summarize(state: graph_schema):
    prompt = f"""
    Summarize the following search results clearly and concisely.
    Keep all important facts, numbers, and key points. /no_think

    Search Results:
    {_truncate(state.get("search_results", ""), 4000)}
    """
    _log_groq_call("summarize")
    summary = llm.invoke(prompt)
    return {"summarized_result": _strip_think(summary.content)}


def evaluate(state: graph_schema):
    prompt = f"""
    Query: {state["query"]}
    Summarized findings: {_truncate(state.get("summarized_result", ""), 2500)}
    Retrieved context: {_truncate(state.get("retrieved_context", ""), 2000)}

    Are these findings sufficient for a detailed research report?
    Answer only: yes or no /no_think
    """
    _log_groq_call("evaluate")
    response = judge_llm.invoke(prompt)
    return {"is_sufficient": "yes" in _strip_think(response.content).lower()}


def human_review(state: graph_schema):
    # The human decision is injected into the state via graph.update_state in Streamlit or main.py
    return {}


def pinecone_store(state: graph_schema):
    from vectorstore.pinecone_store import store_findings

    store_findings([state["summarized_result"]])
    result = {}
    return result


def retrieve_context(state: graph_schema):
    from vectorstore.pinecone_store import retrieve_related

    context = retrieve_related(state["query"])
    return {"retrieved_context": context}


def generate_report(state: graph_schema):
    history = _format_history(state.get("messages", []))
    history_block = (
        f"Conversation so far (earlier turns):\n{history}\n"
        if history
        else "Conversation so far: (this is the first message)\n"
    )

    prompt = f"""
    {history_block}
    Current query: {state["query"]}
    Summarized web research: {_truncate(state.get("summarized_result", ""), 3000)}
    Related past research: {_truncate(state.get("retrieved_context", []), 2000)}

    Task: Write a detailed structured research report to answer the CURRENT QUERY ONLY: "{state["query"]}".
    Use the conversation history above to understand follow-up questions and references to earlier turns. If the current query is about something discussed earlier in the conversation, answer it based on that history.
    DO NOT write a report about the provided research context if it has nothing to do with the current query. If the context is irrelevant, ignore it completely and just answer the query using your own knowledge.

    Include:
    - Executive Summary
    - Key Findings
    - Analysis
    - Conclusion
    /no_think
    """
    _log_groq_call("generate_report")
    report = llm.invoke(prompt)
    print(f"[groq] query complete: {_groq_calls} Groq call(s) total", flush=True)

    return {"final_report": _strip_think(report.content)}


def update_messages(state: graph_schema):
    new_messages = [
        HumanMessage(content=state["query"]),
        AIMessage(content=state["final_report"]),
    ]
    return {"messages": new_messages}
