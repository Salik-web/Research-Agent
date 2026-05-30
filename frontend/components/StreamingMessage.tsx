"use client";

import Markdown from "./Markdown";

/**
 * Assistant reply while it streams in over SSE — plain text, minimal,
 * with a blinking cursor at the end.
 */
export default function StreamingMessage({ text }: { text: string }) {
  return (
    <div className="animate-fade-in text-[0.95rem]">
      {text ? <Markdown>{text}</Markdown> : <ThinkingDots />}
      {text && (
        <span className="ml-0.5 inline-block h-4 w-[2px] animate-cursor-blink bg-accent align-middle" />
      )}
    </div>
  );
}

export function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-muted"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}
