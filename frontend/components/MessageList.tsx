"use client";

import { useEffect, useRef } from "react";
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}

      {phase === "thinking" && <ThinkingDots />}

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
    "What are the health benefits and risks of intermittent fasting?",
    "How is artificial intelligence changing the future of jobs?",
    "What were the main causes of World War I?",
  ];

  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-2 text-2xl font-medium text-ink">Research Agent</h1>
      <p className="mb-8 text-sm text-ink-muted">
        Ask a question — it researches your documents and the web, then writes a
        report.
      </p>
      <div className="grid w-full gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggestion(s)}
            className="rounded-lg border border-surface-border px-4 py-3 text-left text-sm text-ink-muted transition-colors hover:border-accent hover:text-ink"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
