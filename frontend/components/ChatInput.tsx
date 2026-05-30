"use client";

import { Loader2, Paperclip, SendHorizontal, X } from "lucide-react";
import { useRef, useState } from "react";
import { uploadDocument } from "@/lib/api";
import type { ChatPhase } from "@/lib/types";

interface Props {
  phase: ChatPhase;
  onSubmit: (query: string) => void;
  /** Called after a PDF is successfully added to the knowledge base. */
  onUploaded?: () => void;
}

export default function ChatInput({ phase, onSubmit, onUploaded }: Props) {
  const [value, setValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [uploadedNote, setUploadedNote] = useState<string>("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Input is locked while the agent is busy or awaiting a review decision.
  const disabled = phase !== "idle";

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
    if (taRef.current) taRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const autoGrow = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const { chunks } = await uploadDocument(file);
      setUploadedName(file.name);
      setUploadedNote(
        chunks > 0
          ? `· indexed (${chunks} chunk${chunks === 1 ? "" : "s"})`
          : "· no readable text found"
      );
      onUploaded?.();
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const placeholder =
    phase === "pending_review"
      ? "Choose an option above to continue…"
      : phase === "idle"
      ? "Ask a research question…"
      : "Agent is working…";

  return (
    <div className="border-t border-surface-border bg-surface px-4 py-4">
      <div className="mx-auto w-full max-w-3xl">
        {/* Attached-file chip */}
        {uploadedName && (
          <div className="mb-2 flex w-fit items-center gap-2 rounded-lg border border-surface-border bg-surface-raised px-3 py-1.5 text-xs text-ink shadow-sm">
            <Paperclip size={13} className="text-accent" />
            <span className="max-w-[220px] truncate" title={uploadedName}>
              {uploadedName}
            </span>
            <span className="text-ink-muted">{uploadedNote}</span>
            <button
              onClick={() => setUploadedName(null)}
              className="ml-1 text-ink-muted hover:text-ink"
              aria-label="Dismiss"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {uploadError && (
          <p className="mb-2 text-xs text-accent-dark">{uploadError}</p>
        )}

        <div
          className={`flex items-end gap-2 rounded-2xl border bg-surface-raised px-2 py-2 shadow-sm transition-colors ${
            disabled
              ? "border-surface-border opacity-70"
              : "border-surface-border focus-within:border-accent"
          }`}
        >
          {/* Attach PDF */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Attach PDF"
            title="Attach a PDF to the knowledge base"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-accent/10 hover:text-accent disabled:cursor-not-allowed"
          >
            {uploading ? (
              <Loader2 size={18} className="animate-spin text-accent" />
            ) : (
              <Paperclip size={18} />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            onChange={handleFile}
            className="hidden"
          />

          <textarea
            ref={taRef}
            rows={1}
            value={value}
            disabled={disabled}
            onChange={autoGrow}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="max-h-[200px] flex-1 resize-none bg-transparent py-1.5 text-[0.95rem] text-ink placeholder:text-ink-muted/60 focus:outline-none disabled:cursor-not-allowed"
          />
          <button
            onClick={submit}
            disabled={disabled || !value.trim()}
            aria-label="Send"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:bg-surface-border disabled:text-ink-muted"
          >
            <SendHorizontal size={18} />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-ink-muted/80">
          Research Agent can search documents and the web. Attach a PDF with the
          clip to add it to the knowledge base.
        </p>
      </div>
    </div>
  );
}
