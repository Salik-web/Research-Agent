"""FastAPI backend for the Research Agent.

Wraps the existing LangGraph workflow (main.build_graph) and exposes it over
HTTP to the Next.js frontend. Run from the project root:

    .venv\\Scripts\\python.exe -m uvicorn backend.api:app --reload --port 8000

Endpoints (see frontend/lib/api.ts for the matching client):
    POST /api/new-chat              -> { thread_id }
    POST /api/chat   {thread_id,query}    -> { status, findings? }
    POST /api/resume {thread_id,approved} -> { status, findings? }
    GET  /api/stream?thread_id=     -> SSE stream of the final report
    POST /api/upload  (multipart)   -> { filename }
    GET  /api/documents             -> { documents }
"""

import os
import re
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# Load .env before importing the graph (which constructs the LLM client).
load_dotenv()

from main import build_graph  # noqa: E402
from backend.schemas import (  # noqa: E402
    ChatRequest,
    ChatResponse,
    DocumentList,
    NewChatResponse,
    ResumeRequest,
    UploadResponse,
)

# --- App setup ---------------------------------------------------------------

app = FastAPI(title="Research Agent API")


FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")


app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Build the graph once; MemorySaver keeps per-thread state in process memory.
graph = build_graph()

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCUMENTS_DIR = os.path.join(PROJECT_ROOT, "documents")


# --- Helpers -----------------------------------------------------------------

def _config(thread_id: str) -> dict:
    return {"configurable": {"thread_id": thread_id}}


def _to_text(value) -> str:
    """Coerce a state value (str or list) into display text."""
    if isinstance(value, list):
        return "\n\n".join(str(v) for v in value)
    return str(value or "")


def _status_from_state(thread_id: str) -> ChatResponse:
    """Inspect the graph state and report whether we're paused for review."""
    state = graph.get_state(_config(thread_id))
    if state.next and state.next[0] == "human_review":
        findings = _to_text(state.values.get("summarized_result", ""))
        return ChatResponse(status="pending_review", findings=findings)
    return ChatResponse(status="ready_to_stream")


# SSE: strip any Qwen <think> reasoning that slips through, even mid-stream.
_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL)


def _clean_think(text: str) -> str:
    cleaned = _THINK_RE.sub("", text)
    if "<think>" in cleaned:  # unclosed block -> still "thinking", suppress rest
        cleaned = cleaned[: cleaned.index("<think>")]
    return cleaned


def _sse(text: str) -> str:
    """Format a chunk as an SSE data frame, preserving embedded newlines."""
    return "".join(f"data: {line}\n" for line in text.split("\n")) + "\n"


# --- Endpoints ---------------------------------------------------------------

@app.post("/api/new-chat", response_model=NewChatResponse)
def new_chat():
    return NewChatResponse(thread_id=str(uuid.uuid4()))


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    initial_state = {
        "query": req.query,
        "iterations": 0,
        "human_approved": False,
        "messages": [],
    }
    try:
        graph.invoke(initial_state, config=_config(req.thread_id))
    except Exception as e:  # surface graph/LLM errors to the UI banner
        raise HTTPException(status_code=500, detail=str(e))
    return _status_from_state(req.thread_id)


@app.post("/api/resume", response_model=ChatResponse)
def resume(req: ResumeRequest):
    cfg = _config(req.thread_id)
    graph.update_state(cfg, {"human_approved": req.approved})

    # Approved -> defer generate_report to /api/stream so its tokens stream live.
    if req.approved:
        return ChatResponse(status="ready_to_stream")

    # "Search more" -> run the search loop until the next review (or completion).
    try:
        graph.invoke(None, cfg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return _status_from_state(req.thread_id)


@app.get("/api/stream")
def stream(thread_id: str):
    """Resume the approved graph and stream the report tokens as SSE."""
    cfg = _config(thread_id)

    def event_generator():
        emitted = 0
        acc = ""
        try:
            for chunk, meta in graph.stream(None, cfg, stream_mode="messages"):
                # Only stream tokens produced by generate_report. Other nodes
                # (notably update_messages, which appends the finished report as
                # an AIMessage) would otherwise re-emit the report and duplicate it.
                node = (meta or {}).get("langgraph_node")
                if node and node != "generate_report":
                    continue
                text = getattr(chunk, "content", "") or ""
                if not text:
                    continue
                acc += text
                cleaned = _clean_think(acc)
                # Hold back the last few chars in case they're a partial tag.
                target = max(0, len(cleaned) - 8)
                if target > emitted:
                    yield _sse(cleaned[emitted:target])
                    emitted = target
            # Flush whatever remains after the stream ends.
            cleaned = _clean_think(acc)
            if len(cleaned) > emitted:
                yield _sse(cleaned[emitted:])
            yield "event: done\ndata: [DONE]\n\n"
        except Exception as e:
            yield f"event: error\ndata: {str(e)[:300]}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/upload", response_model=UploadResponse)
async def upload(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    os.makedirs(DOCUMENTS_DIR, exist_ok=True)
    dest = os.path.join(DOCUMENTS_DIR, os.path.basename(file.filename))
    with open(dest, "wb") as f:
        f.write(await file.read())

    # Embed it now so it's searchable immediately (don't rely on the graph's
    # load_documents, which only ingests when the whole index is empty).
    from vectorstore.pinecone_store import ingest_pdf

    try:
        chunks = ingest_pdf(dest)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Saved the file but failed to index it: {e}",
        )

    return UploadResponse(filename=file.filename, chunks=chunks)


@app.get("/api/documents", response_model=DocumentList)
def documents():
    os.makedirs(DOCUMENTS_DIR, exist_ok=True)
    files = sorted(
        f for f in os.listdir(DOCUMENTS_DIR) if f.lower().endswith(".pdf")
    )
    return DocumentList(documents=files)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/debug-env")
def debug_env():
    """TEMPORARY: reports which key env vars the container sees (names only,
    no values). Remove after diagnosing."""
    expected = [
        "GROQ_API_KEY",
        "PINECONE_API_KEY",
        "TAVILY_API_KEY",
        "LANGCHAIN_API_KEY",
        "LANGCHAIN_TRACING_V2",
        "LANGCHAIN_PROJECT",
    ]
    present = {k: bool(os.getenv(k)) for k in expected}
    keyish = sorted(
        n
        for n in os.environ
        if any(s in n.upper() for s in ["PINECONE", "GROQ", "TAVILY", "LANGCHAIN", "LANGSMITH"])
    )
    return {"present": present, "keyish_names_found": keyish}
