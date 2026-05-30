"use client";

import { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import type { ChatMessage, ChatPhase } from "@/lib/types";
import MessageBubble from "./MessageBubble";
import StreamingMessage, { ThinkingDots } from "./StreamingMessage";
import ReviewPanel from "./ReviewPanel";

interface Props {
  messages: ChatMessage[];
  phase: ChatPhase;
  findings: string;
  streamingText: string;
  onDecide: (approved: boolean) => void;
  onSuggestion: (query: string) => void;
}

export default function MessageList({
  messages,
  phase,
  findings,
  streamingText,
  onDecide,
  onSuggestion,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase, streamingText, findings]);

  const isEmpty = messages.length === 0 && phase === "idle";

  if (isEmpty) {
    return <EmptyState onSuggestion={onSuggestion} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}

      {phase === "thinking" && (
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
            <Search size={16} />
          </div>
          <div className="rounded-2xl border border-surface-border bg-surface-raised px-4 py-3 shadow-sm">
            <ThinkingDots />
          </div>
        </div>
      )}

      {phase === "pending_review" && (
        <ReviewPanel findings={findings} onDecide={onDecide} />
      )}

      {phase === "streaming" && <StreamingMessage text={streamingText} />}

      <div ref={bottomRef} />
    </div>
  );
}

function EmptyState({
  onSuggestion,
}: {
  onSuggestion: (query: string) => void;
}) {
  const suggestions = [
    "Summarize the latest advances in agentic RAG systems",
    "What are the trade-offs of vector databases for retrieval?",
    "Compare LangGraph and traditional agent frameworks",
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-md">
        <Search size={30} />
      </div>
      <h1 className="mb-2 text-2xl font-semibold text-ink">Research Agent</h1>
      <p className="max-w-md text-sm text-ink-muted">
        Ask any research question. The agent searches your documents and the
        web, then lets you review the findings before writing a full report.
      </p>
      <div className="mt-6 grid w-full max-w-md gap-2 text-left">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggestion(s)}
            className="rounded-xl border border-surface-border bg-surface-raised px-4 py-3 text-left text-sm text-ink shadow-sm transition-colors hover:border-accent hover:bg-accent/10"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
