"use client";

import type { ChatMessage } from "@/lib/types";
import Markdown from "./Markdown";

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex animate-fade-in justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-accent px-4 py-2.5 text-[0.95rem] leading-relaxed text-accent-fg">
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant: plain text, no bubble — minimal.
  return (
    <div className="animate-fade-in text-[0.95rem]">
      <Markdown>{message.content}</Markdown>
    </div>
  );
}
