# 🔍 Research Agent

An **Agentic RAG** (Retrieval-Augmented Generation) system built with **LangGraph** that autonomously researches any topic by combining internal document knowledge with live web search. Features a **Human-in-the-Loop** review process and **real-time streaming** output via a Streamlit interface.

![Python](https://img.shields.io/badge/Python-3.14+-blue?logo=python)
![Streamlit](https://img.shields.io/badge/Streamlit-Frontend-FF4B4B?logo=streamlit)
![LangGraph](https://img.shields.io/badge/LangGraph-Orchestration-blue)
![Groq](https://img.shields.io/badge/Groq-LLM-orange)

---

## ✨ Features

- **Agentic Workflow** — Autonomous multi-step research pipeline powered by LangGraph
- **RAG from PDFs** — Upload PDFs to build a knowledge base; the agent retrieves relevant context using Pinecone vector search
- **Live Web Search** — Falls back to Tavily web search when internal documents don't have the answer
- **Human-in-the-Loop** — Review research findings before final report generation; approve or request more information
- **Streaming Output** — Final reports stream word-by-word with a typewriter effect for a ChatGPT-like experience
- **Conversation Memory** — Maintains chat history within each session using LangGraph checkpointers

---

## 🏗️ Architecture

```
User Query
    │
    ▼
┌──────────────────┐
│  Load Documents   │  ← Ingest PDFs into Pinecone (if needed)
└────────┬─────────┘
         ▼
┌──────────────────┐
│ Retrieve Context  │  ← Vector similarity search in Pinecone
└────────┬─────────┘
         ▼
┌──────────────────┐
│ Evaluate Context  │  ← LLM judges if context answers the query
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
 Sufficient  Not Sufficient
    │         │
    │         ▼
    │   ┌────────────┐
    │   │ Web Search  │  ← Tavily API
    │   └─────┬──────┘
    │         ▼
    │   ┌────────────┐
    │   │ Summarize   │  ← LLM summarizes results
    │   └─────┬──────┘
    │         ▼
    │   ┌────────────┐
    │   │  Evaluate   │  ← LLM checks quality
    │   └─────┬──────┘
    │         │
    ▼         ▼
┌──────────────────┐
│  Human Review     │  ← User approves or requests more search
└────────┬─────────┘
    ┌────┴────┐
 Approve    Search More
    │         │
    ▼         └──→ (back to Web Search)
┌──────────────────┐
│ Generate Report   │  ← LLM writes structured report
└────────┬─────────┘
         ▼
    Final Report (streamed word-by-word)
```

---

## 🛠️ Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Orchestration** | [LangGraph](https://github.com/langchain-ai/langgraph) | Stateful agent workflow with conditional routing & interrupts |
| **LLM** | [Groq](https://groq.com/) (Qwen3-32B) | Fast inference for evaluation, summarization & report generation |
| **Vector Store** | [Pinecone](https://www.pinecone.io/) | Serverless vector database for document embeddings |
| **Embeddings** | [HuggingFace](https://huggingface.co/) (all-MiniLM-L6-v2) | Sentence embeddings for similarity search |
| **Web Search** | [Tavily](https://tavily.com/) | AI-optimized search API for real-time web research |
| **Frontend** | [Streamlit](https://streamlit.io/) | Chat-based UI with streaming, file upload & interactive buttons |
| **PDF Loading** | LangChain PyPDF | Extract text from uploaded PDF documents |
| **Streaming** | Streamlit `write_stream` | Word-by-word typewriter effect for report output |

---

## 📁 Project Structure

```
ResearchAgent/
├── app.py                     # Streamlit frontend with streaming UI
├── main.py                    # LangGraph workflow definition
├── graph/
│   ├── state.py               # Graph state schema (TypedDict)
│   ├── nodes.py               # Node functions (search, summarize, evaluate, etc.)
│   └── edges.py               # Conditional routing logic
├── tools/
│   └── tools.py               # Tavily web search tool
├── vectorstore/
│   └── pinecone_store.py      # Pinecone vector store operations
├── documents/                 # Uploaded PDFs (git-ignored)
├── pyproject.toml             # Python dependencies
├── requirements.txt           # Pip requirements
└── .env                       # API keys (git-ignored)
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.14+
- [uv](https://docs.astral.sh/uv/) (recommended) or pip
- API keys for: **Groq**, **Pinecone**, **Tavily**

### 1. Clone the repository

```bash
git clone https://github.com/Salik-web/Research-Agent.git
cd Research-Agent
```

### 2. Set up environment variables

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key
PINECONE_API_KEY=your_pinecone_api_key
TAVILY_API_KEY=your_tavily_api_key
```

### 3. Install dependencies

**Using uv (recommended):**
```bash
uv sync
```

**Using pip:**
```bash
pip install -r requirements.txt
```

### 4. Run the app

```bash
uv run streamlit run app.py
```

---

## 📖 How to Use

1. **Upload PDFs** — Use the sidebar to upload PDF documents to your knowledge base
2. **Ask a question** — Type your research query in the chat input
3. **Review findings** — The agent will show you what it found and ask for approval
4. **Choose an action** — Click **"Generate Report"** to get the final answer, or **"Search More"** to gather additional information
5. **Read the streamed report** — The final report appears word-by-word with a smooth typewriter effect

---
