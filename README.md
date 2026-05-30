# 🔍 Research Agent

A full-stack **Agentic RAG** (Retrieval-Augmented Generation) application that autonomously researches any topic by combining your uploaded documents with live web search. It features a **human-in-the-loop** review step, **real-time token streaming**, and **multi-conversation chat history** — wrapped in a ChatGPT/Claude-style UI.

![Next.js](https://img.shields.io/badge/Next.js-Frontend-black?logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi)
![LangGraph](https://img.shields.io/badge/LangGraph-Orchestration-blue)
![Groq](https://img.shields.io/badge/Groq-LLM-orange)

> **Live demo:** Frontend on Vercel · Backend API on Hugging Face Spaces
> _(add your URLs here once deployed)_

---

## ✨ Features

- **Agentic workflow** — a multi-step LangGraph pipeline that retrieves, evaluates, searches, and writes.
- **RAG from your PDFs** — upload PDFs in the chat bar; they're embedded into Pinecone and searched on every query.
- **Live web search** — falls back to Tavily when your documents don't cover the question.
- **Human-in-the-loop** — review the findings, then **Generate Report** or **Search More**.
- **Real token streaming** — the final report streams token-by-token over SSE (true ChatGPT-style typing).
- **Multi-conversation history** — a sidebar of past chats persisted in `localStorage`, each with its own durable memory.
- **Conversation memory** — follow-ups remember the last few turns of the chat (SQLite-backed, survives restarts).

---

## 🏗️ Architecture

A two-tier app: a **Next.js** frontend talking over HTTP/SSE to a **FastAPI** backend that drives the LangGraph workflow.

```
┌─────────────────────┐      HTTP + SSE      ┌──────────────────────┐
│   Next.js (Vercel)  │ ◄──────────────────► │  FastAPI (HF Spaces) │
│  chat UI · history  │                      │   wraps LangGraph    │
└─────────────────────┘                      └──────────┬───────────┘
                                                         │
                          ┌──────────────────────────────┼───────────────────────────┐
                          ▼                               ▼                            ▼
                    Groq (Qwen3-32B)              Pinecone (vectors)           Tavily (web search)
```

### The LangGraph pipeline

```
START
  │
  ▼
load_documents ──► contextualize_query ──► retrieve_context ──► evaluate_context
                   (rewrite follow-ups)    (Pinecone search)         │
                                                          ┌──────────┴──────────┐
                                                     sufficient            not sufficient
                                                          │                     ▼
                                                          │              web_search → summarize → evaluate
                                                          │                     │
                                                          ▼                     ▼
                                                      human_review  ◄───────────┘   (interrupt: wait for user)
                                                          │
                                              ┌───────────┼─────────────┐
                                         approve      approve+web    search more
                                              │        (store)            │
                                              ▼           ▼               └──► web_search
                                        generate_report (streamed) ──► update_messages ──► END
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js (App Router) · TypeScript · Tailwind CSS — deployed on **Vercel** |
| **Backend** | FastAPI · Uvicorn — deployed on **Hugging Face Spaces** (Docker) |
| **Orchestration** | [LangGraph](https://github.com/langchain-ai/langgraph) — stateful graph with conditional routing, interrupts & SQLite checkpointer |
| **LLM** | [Groq](https://groq.com/) (Qwen3-32B) |
| **Vector store** | [Pinecone](https://www.pinecone.io/) (serverless) |
| **Embeddings** | [HuggingFace](https://huggingface.co/) `all-MiniLM-L6-v2` |
| **Web search** | [Tavily](https://tavily.com/) |
| **Tracing** | [LangSmith](https://smith.langchain.com/) (optional) |

---

## 📁 Project Structure

```
Research-Agent/
├── backend/
│   ├── api.py              # FastAPI app: chat / resume / stream (SSE) / upload / documents
│   └── schemas.py          # Pydantic request/response models
├── frontend/
│   ├── app/                # Next.js App Router (layout, page, globals)
│   ├── components/         # Sidebar, MessageList, ChatInput, ReviewPanel, ...
│   └── lib/                # API client, types, useResearchChat hook
├── graph/
│   ├── state.py            # Graph state schema (TypedDict)
│   ├── nodes.py            # Node functions (contextualize, retrieve, summarize, report, ...)
│   └── edges.py            # Conditional routing logic
├── tools/tools.py          # Tavily web search tool
├── vectorstore/pinecone_store.py  # Pinecone ops + per-PDF ingestion
├── main.py                 # build_graph() — LangGraph workflow definition
├── app.py                  # (legacy) standalone Streamlit UI
├── Dockerfile              # Backend container (for HF Spaces)
├── requirements.txt
└── .env.example            # Required env vars (no secrets)
```

---

## 🚀 Local Development

You run **two** processes: the backend (port 8000) and the frontend (port 3000).

### Prerequisites
- Python 3.12+ and [uv](https://docs.astral.sh/uv/) (or pip)
- Node.js 18.18+
- API keys: **Groq**, **Pinecone**, **Tavily** (LangSmith optional)

### 1. Backend

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

### 2. Frontend

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

---

## ☁️ Deployment

- **Backend → Hugging Face Spaces (Docker).** Push the repo (minus `frontend/`) to a Docker Space; set `GROQ_API_KEY`, `PINECONE_API_KEY`, `TAVILY_API_KEY` (and the LangSmith vars) as **Space Secrets**. The container serves on port `7860`.
- **Frontend → Vercel.** Import the repo, set **Root Directory = `frontend`**, and add `NEXT_PUBLIC_API_URL` = your Space URL.
- **CORS.** Set `FRONTEND_ORIGIN` (a backend env var) to your Vercel URL so the browser is allowed to call the API.

---

## 📖 How to Use

1. **Upload a PDF** (optional) via the clip in the chat bar — it's indexed into the knowledge base immediately.
2. **Ask a research question.**
3. **Review the findings** the agent gathered, then click **Generate Report** or **Search More**.
4. **Read the streamed report.** Start a **New Chat** or revisit past ones from the sidebar.

---

## 🗂️ Legacy: Streamlit UI

Before the Next.js + FastAPI rewrite, this project shipped as a single **Streamlit** app ([`app.py`](app.py)). It's kept in the repo as a **legacy / standalone** alternative that talks to the same LangGraph workflow directly (no separate backend needed). To run it:

```bash
uv run streamlit run app.py
```

It uses the same root `.env`. The Next.js + FastAPI stack above is the current, primary interface; `app.py` is retained for reference and quick local testing.

---

## 📝 Notes

- On free tiers, the agent respects Groq's rate limits (it trims context, caps output, and retries on limit) — a query may pause briefly during heavy use.
- Chat history is stored per-browser (`localStorage`); the agent's per-conversation memory is stored server-side in SQLite.
