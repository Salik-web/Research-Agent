"use client";

import { useEffect, useState } from "react";
import { FileText, Plus, Trash2, X } from "lucide-react";
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
  busy: boolean;
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

  const ordered = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-surface-border bg-surface-sidebar transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Wordmark (monogram, no magnifying glass) */}
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-xs font-semibold text-accent-fg">
              R
            </span>
            <span className="text-sm font-medium text-ink">Research Agent</span>
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
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-accent/10 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={16} />
            New chat
          </button>
        </div>

        {/* Conversations */}
        <div className="mt-4 flex min-h-0 flex-1 flex-col px-3">
          <h2 className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-ink-muted/70">
            Chats
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {ordered.length === 0 ? (
              <p className="px-3 text-xs text-ink-muted/70">No chats yet.</p>
            ) : (
              <ul className="space-y-0.5">
                {ordered.map((c) => {
                  const isActive = c.id === activeId;
                  return (
                    <li key={c.id}>
                      <div
                        className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                          isActive
                            ? "bg-accent/10 text-ink"
                            : "text-ink-muted hover:bg-accent/5 hover:text-ink"
                        } ${busy ? "cursor-not-allowed" : "cursor-pointer"}`}
                        onClick={() => !busy && onSelect(c.id)}
                      >
                        <span
                          className="flex-1 truncate"
                          title={c.title || "New chat"}
                        >
                          {c.title || "New chat"}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!busy) onDelete(c.id);
                          }}
                          disabled={busy}
                          aria-label="Delete chat"
                          className="shrink-0 text-ink-muted/60 opacity-0 transition-opacity hover:text-accent group-hover:opacity-100 disabled:cursor-not-allowed"
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
        <div className="flex max-h-44 flex-col border-t border-surface-border px-3 py-3">
          <h2 className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-ink-muted/70">
            Documents
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {docs.length === 0 ? (
              <p className="px-3 text-xs text-ink-muted/70">
                Attach a PDF in the chat bar.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {docs.map((d) => (
                  <li
                    key={d}
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-ink-muted"
                  >
                    <FileText size={14} className="shrink-0 opacity-70" />
                    <span className="truncate" title={d}>
                      {d}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
