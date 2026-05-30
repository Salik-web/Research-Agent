"use client";

import Markdown from "./Markdown";

interface Props {
  findings: string;
  onDecide: (approved: boolean) => void;
}

/**
 * Human-in-the-loop review. Minimal: findings text + two plain actions.
 */
export default function ReviewPanel({ findings, onDecide }: Props) {
  return (
    <div className="animate-fade-in border-l-2 border-accent/40 pl-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-muted">
        Findings so far
      </p>

      <div className="text-[0.95rem]">
        {findings ? (
          <Markdown>{findings}</Markdown>
        ) : (
          <p className="text-sm text-ink-muted">No findings returned.</p>
        )}
      </div>

      <p className="mt-4 mb-2 text-sm text-ink-muted">
        Generate the report now, or keep searching?
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onDecide(true)}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-dark"
        >
          Generate report
        </button>
        <button
          onClick={() => onDecide(false)}
          className="rounded-lg border border-surface-border px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:border-accent hover:text-ink"
        >
          Search more
        </button>
      </div>
    </div>
  );
}
