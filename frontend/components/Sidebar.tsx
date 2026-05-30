"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  MessageSquare,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { listDocuments } from "@/lib/api";
import type { Conversation } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeId: string;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  /** Locks list interactions while the agent is busy. */
  busy: boolean;
  /** Bump to re-fetch the document list (e.g. after an upload). */
  refreshKey?: number;
}

export default function Sidebar({
  open,
  onClose,
  conversations,
  activeId,
  onNewChat,
  onSelect,
  onDelete,
  busy,
  refreshKey,
}: Props) {
  const [docs, setDocs] = useState<string[]>([]);

  useEffect(() => {
    listDocuments()
      .then((r) => setDocs(r.documents))
      .catch(() => setDocs([]));
  }, [refreshKey]);

  // Most-recently updated first.
  const ordered = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-surface-border bg-surface-sidebar transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg">
              <Search size={16} />
            </div>
            <span className="font-semibold text-ink">Research Agent</span>
          </div>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink md:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* New chat */}
        <div className="px-3">
          <button
            onClick={onNewChat}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-surface-border bg-surface-raised px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={16} />
            New Chat
          </button>
        </div>

        {/* Conversation list */}
        <div className="mt-5 flex min-h-0 flex-1 flex-col px-3">
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Chats
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {ordered.length === 0 ? (
              <p className="px-1 text-xs text-ink-muted/80">No chats yet.</p>
            ) : (
              <ul className="space-y-1">
                {ordered.map((c) => {
                  const isActive = c.id === activeId;
                  return (
                    <li key={c.id}>
                      <div
                        className={`group flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                          isActive
                            ? "bg-accent/15 text-ink"
                            : "text-ink-muted hover:bg-surface-raised hover:text-ink"
                        } ${busy ? "cursor-not-allowed" : "cursor-pointer"}`}
                        onClick={() => !busy && onSelect(c.id)}
                      >
                        <MessageSquare
                          size={15}
                          className={`shrink-0 ${
                            isActive ? "text-accent" : "text-ink-muted"
                          }`}
                        />
                        <span className="flex-1 truncate" title={c.title || "New chat"}>
                          {c.title || "New chat"}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!busy) onDelete(c.id);
                          }}
                          disabled={busy}
                          aria-label="Delete chat"
                          className="shrink-0 text-ink-muted opacity-0 transition-opacity hover:text-accent group-hover:opacity-100 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Knowledge base */}
        <div className="flex max-h-48 flex-col border-t border-surface-border px-3 py-3">
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Knowledge Base
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {docs.length === 0 ? (
              <p className="px-1 text-xs text-ink-muted/80">
                No documents yet. Attach a PDF in the chat bar.
              </p>
            ) : (
              <ul className="space-y-1">
                {docs.map((d) => (
                  <li
                    key={d}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink"
                  >
                    <FileText size={14} className="shrink-0 text-accent" />
                    <span className="truncate" title={d}>
                      {d}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="border-t border-surface-border px-4 py-3 text-xs text-ink-muted/80">
          Agentic RAG · LangGraph · Groq
        </div>
      </aside>
    </>
  );
}
