"use client";

import { Search, User } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import Markdown from "./Markdown";

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex w-full animate-fade-in gap-3 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar */}
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-accent-dark text-accent-fg" : "bg-accent text-accent-fg"
        }`}
        aria-hidden
      >
        {isUser ? <User size={16} /> : <Search size={16} />}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-[0.95rem] leading-relaxed shadow-sm ${
          isUser
            ? "bg-accent text-accent-fg"
            : "border border-surface-border bg-surface-raised text-ink"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <Markdown>{message.content}</Markdown>
        )}
      </div>
    </div>
  );
}
