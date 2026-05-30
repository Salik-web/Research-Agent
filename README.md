# Research Agent

A full-stack Agentic RAG (Retrieval-Augmented Generation) application that researches any topic by combining your uploaded documents with live web search. It has a human-in-the-loop review step, real-time token streaming, and multi-conversation chat history — in a ChatGPT-style interface.

- Live demo: https://research-agent-tau-henna.vercel.app/
- Code: https://github.com/Salik-web/Research-Agent

## Features

- Agentic workflow — a multi-step LangGraph pipeline that retrieves, evaluates, searches, and writes.
- RAG from your PDFs — upload a PDF in the chat bar; it's embedded into Pinecone and searched on every query.
- Live web search — falls back to Tavily when your documents don't cover the question.
- Human-in-the-loop — review the findings, then generate the report or keep searching.
- Real token streaming — the final report streams token-by-token over Server-Sent Events.
- Multi-conversation history — a sidebar of past chats (stored in the browser), each with its own memory.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS — deployed on Vercel |
| Backend | FastAPI, Uvicorn — deployed on Hugging Face Spaces (Docker) |
| Orchestration | LangGraph (stateful graph with conditional routing, interrupts, SQLite checkpointer) |
| LLM | Groq (Qwen3-32B) |
| Vector store | Pinecone (serverless) |
| Embeddings | HuggingFace all-MiniLM-L6-v2 |
| Web search | Tavily |
| Tracing | LangSmith (optional) |

## Architecture

A two-tier app: a Next.js frontend talks over HTTP/SSE to a FastAPI backend that drives the LangGraph workflow, which in turn uses Groq, Pinecone, and Tavily.

The agent pipeline: load documents → contextualize the query → retrieve from Pinecone → judge if that's enough → (if not) web search, summarize, evaluate → pause for human review → generate the report (streamed) → save to memory.

## Project Structure

```
Research-Agent/
├── backend/
│   ├── api.py              # FastAPI app: chat / resume / stream (SSE) / upload / documents
│   └── schemas.py          # Pydantic request/response models
├── frontend/
│   ├── app/                # Next.js App Router (layout, page, globals)
│   ├── components/         # Sidebar, MessageList, ChatInput, ReviewPanel, ...
│   └── lib/                # API client, types, chat hook
├── graph/
│   ├── state.py            # Graph state schema
│   ├── nodes.py            # Node functions (contextualize, retrieve, summarize, report, ...)
│   └── edges.py            # Conditional routing
├── tools/tools.py          # Tavily web search tool
├── vectorstore/pinecone_store.py  # Pinecone ops + per-PDF ingestion
├── main.py                 # build_graph() — the LangGraph workflow
├── app.py                  # legacy standalone Streamlit UI
├── Dockerfile              # Backend container (for Hugging Face Spaces)
├── requirements.txt
└── .env.example            # Required env vars (no secrets)
```

## Local Development

You run two processes: the backend (port 8000) and the frontend (port 3000).

Prerequisites: Python 3.12+ with uv (or pip), Node.js 18.18+, and API keys for Groq, Pinecone, and Tavily (LangSmith optional).

### Backend

Create a `.env` in the project root (see `.env.example`):

```env
GROQ_API_KEY=your_groq_api_key
PINECONE_API_KEY=your_pinecone_api_key
TAVILY_API_KEY=your_tavily_api_key
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_langsmith_api_key
LANGCHAIN_PROJECT=ResearchAgent
```

Install and run:

```bash
uv sync                       # or: pip install -r requirements.txt
uv run uvicorn backend.api:app --reload --port 8000
```

### Frontend

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Install and run:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.

## Deployment

- Backend on Hugging Face Spaces (Docker): the keys are set as Space Secrets; the container serves on port 7860.
- Frontend on Vercel: Root Directory is `frontend`, with `NEXT_PUBLIC_API_URL` set to the backend URL.
- CORS: the backend's `FRONTEND_ORIGIN` env var is set to the Vercel URL.

## Legacy: Streamlit UI

Before the Next.js + FastAPI rewrite, this project shipped as a single Streamlit app (`app.py`). It's kept in the repo as a legacy, standalone alternative that talks to the same LangGraph workflow directly. Run it with:

```bash
uv run streamlit run app.py
```
