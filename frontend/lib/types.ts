// Shared types for the Research Agent frontend.
// These mirror the planned FastAPI backend contract. If the backend shape
// changes later, update this file (and lib/api.ts) — the rest of the UI
// depends only on these types.

export type Role = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
}

/** A single conversation thread. Its `id` IS the backend thread_id. */
export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

/** Status returned by /api/chat and /api/resume. */
export type AgentStatus = "pending_review" | "ready_to_stream";

export interface ChatResponse {
  status: AgentStatus;
  /** Present when status === "pending_review": the summarized findings so far. */
  findings?: string;
}

export interface NewChatResponse {
  thread_id: string;
}

export interface DocumentList {
  documents: string[];
}

/** High-level UI flow phases. */
export type ChatPhase =
  | "idle" // ready for a new query
  | "thinking" // waiting on /api/chat or /api/resume
  | "pending_review" // showing findings + approve/search-more buttons
  | "streaming"; // receiving the final report over SSE
