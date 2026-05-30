"use client";

import { Brain, FileText, Search } from "lucide-react";
import Markdown from "./Markdown";

interface Props {
  findings: string;
  onDecide: (approved: boolean) => void;
}

/**
 * Human-in-the-loop review card. Mirrors the approve / search-more buttons
 * from the original Streamlit app (app.py lines 122-170).
 */
export default function ReviewPanel({ findings, onDecide }: Props) {
  return (
    <div className="flex w-full animate-fade-in gap-3">
      <div
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg"
        aria-hidden
      >
        <Search size={16} />
      </div>

      <div className="w-full max-w-[80%] rounded-2xl border border-accent/30 bg-surface-raised shadow-sm">
        <div className="flex items-center gap-2 border-b border-surface-border px-4 py-3">
          <Brain size={18} className="text-accent" />
          <h3 className="font-semibold text-ink">Research Findings So Far</h3>
        </div>

        <div className="max-h-72 overflow-y-auto px-4 py-3">
          {findings ? (
            <Markdown>{findings}</Markdown>
          ) : (
            <p className="text-sm text-ink-muted">No findings returned.</p>
          )}
        </div>

        <div className="border-t border-surface-border px-4 py-3">
          <p className="mb-3 text-sm text-ink">
            Generate the final report now, or search the web for more
            information?
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => onDecide(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-dark"
            >
              <FileText size={16} />
              Generate Report
            </button>
            <button
              onClick={() => onDecide(false)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-accent bg-transparent px-4 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/10"
            >
              <Search size={16} />
              Search More
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
