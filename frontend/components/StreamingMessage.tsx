"use client";

import { Search } from "lucide-react";
import Markdown from "./Markdown";

/**
 * The assistant bubble shown while the report streams in over SSE.
 * Renders accumulated markdown with a blinking cursor at the end.
 */
export default function StreamingMessage({ text }: { text: string }) {
  return (
    <div className="flex w-full animate-fade-in gap-3">
      <div
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg"
        aria-hidden
      >
        <Search size={16} />
      </div>
      <div className="max-w-[80%] rounded-2xl border border-surface-border bg-surface-raised px-4 py-3 shadow-sm">
        {text ? <Markdown>{text}</Markdown> : <ThinkingDots />}
        {text && (
          <span className="ml-0.5 inline-block h-4 w-[2px] animate-cursor-blink bg-accent align-middle" />
        )}
      </div>
    </div>
  );
}

export function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 animate-bounce rounded-full bg-accent"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}
