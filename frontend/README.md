# Research Agent — Frontend (Next.js)

A ChatGPT/Claude-style chat UI for the Research Agent, built with **Next.js (App
Router) + TypeScript + Tailwind CSS**. It replaces the old Streamlit `app.py`.

Styled with the **maroon + beige** palette:

| Hex | Role |
|-----|------|
| `#62191C` | maroon-dark — deepest accent / user bubble |
| `#873632` | maroon — primary action buttons / avatars |
| `#9E7161` | taupe — secondary text, borders |
| `#CAAE9F` | beige — emphasis, links |
| `#E0CFC2` | beige-light — body text |

## Features

- Chat thread with user / assistant bubbles and markdown report rendering
- **Human-in-the-loop review panel** (Generate Report / Search More)
- **Real token streaming** of the final report via Server-Sent Events
- Sidebar: New Chat, PDF upload, knowledge-base document list
- Responsive (collapsible sidebar on mobile), graceful error banner

## Prerequisites

- Node.js 18.18+ (or 20+)
- The Python **FastAPI backend** running on `http://localhost:8000`
  (not yet built — see the backend plan). Until it exists, the UI loads but
  requests will show an error banner.

## Setup

```bash
cd frontend
npm install
```

Configure the backend URL in `.env.local` (already created with the default):

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Run

```bash
npm run dev
```

Open http://localhost:3000.

## Backend API contract

The frontend expects these endpoints (see `lib/api.ts` / `lib/types.ts`):

| Method | Route | Body / Query | Returns |
|--------|-------|--------------|---------|
| `POST` | `/api/new-chat` | — | `{ thread_id }` |
| `POST` | `/api/chat` | `{ thread_id, query }` | `{ status: "pending_review" \| "ready_to_stream", findings? }` |
| `POST` | `/api/resume` | `{ thread_id, approved }` | same as `/api/chat` |
| `GET`  | `/api/stream` | `?thread_id=` | SSE: `data:` token chunks, then `event: done` (or `data: [DONE]`) |
| `POST` | `/api/upload` | multipart `file` | 200 OK |
| `GET`  | `/api/documents` | — | `{ documents: string[] }` |

> The SSE stream should already strip Qwen3 `<think>…</think>` blocks before
> emitting tokens (the frontend renders whatever it receives verbatim).

## Project structure

```
frontend/
├── app/
│   ├── layout.tsx        # Root layout, Inter font, theme
│   ├── page.tsx          # Main chat orchestration
│   └── globals.css       # Tailwind + themed prose styles
├── components/
│   ├── Sidebar.tsx       # New chat, upload, document list
│   ├── MessageList.tsx   # Thread + empty state + phase rendering
│   ├── MessageBubble.tsx # User / assistant bubble
│   ├── StreamingMessage.tsx
│   ├── ReviewPanel.tsx   # Human-in-the-loop approve / search-more
│   ├── ChatInput.tsx     # Auto-growing input bar
│   └── Markdown.tsx      # Themed react-markdown wrapper
└── lib/
    ├── types.ts          # Shared types / API contract
    ├── api.ts            # Typed fetch wrappers + SSE parser
    └── useResearchChat.ts# Conversation state machine
```
