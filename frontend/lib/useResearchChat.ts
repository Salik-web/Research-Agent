"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resumeReview, sendQuery, streamReport } from "./api";
import type {
  ChatMessage,
  ChatPhase,
  ChatResponse,
  Conversation,
} from "./types";

const STORAGE_KEY = "research-agent:conversations:v1";
const ACTIVE_KEY = "research-agent:active:v1";

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function newConversation(): Conversation {
  return { id: uid(), title: "", messages: [], updatedAt: Date.now() };
}

/**
 * Manages many conversations (ChatGPT-style history).
 *
 * - Each conversation's `id` is used as the backend thread_id, so switching
 *   conversations switches which thread the agent remembers.
 * - The list is persisted to localStorage (survives page reloads).
 * - Transient state (phase/findings/streamingText) belongs to the active,
 *   in-flight conversation; switching is locked while the agent is busy, so
 *   that state always refers to the active conversation.
 */
export function useResearchChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [loaded, setLoaded] = useState(false);

  const [phase, setPhase] = useState<ChatPhase>("idle");
  const [findings, setFindings] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cancelRef = useRef<(() => void) | null>(null);

  // --- Load from localStorage once (client only) ---
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const savedActive = localStorage.getItem(ACTIVE_KEY);
      const parsed: Conversation[] = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setConversations(parsed);
        const exists = parsed.some((c) => c.id === savedActive);
        setActiveId(exists ? (savedActive as string) : parsed[0].id);
      } else {
        const c = newConversation();
        setConversations([c]);
        setActiveId(c.id);
      }
    } catch {
      const c = newConversation();
      setConversations([c]);
      setActiveId(c.id);
    }
    setLoaded(true);
    return () => cancelRef.current?.();
  }, []);

  // --- Persist on change ---
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
      localStorage.setItem(ACTIVE_KEY, activeId);
    } catch {
      // storage full / unavailable — non-fatal
    }
  }, [conversations, activeId, loaded]);

  const messages = useMemo(
    () => conversations.find((c) => c.id === activeId)?.messages ?? [],
    [conversations, activeId]
  );

  const patchConversation = useCallback(
    (id: string, updater: (c: Conversation) => Conversation) => {
      setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
    },
    []
  );

  const appendMessage = useCallback(
    (id: string, msg: ChatMessage) => {
      patchConversation(id, (c) => ({
        ...c,
        messages: [...c.messages, msg],
        // Title from the first user message.
        title:
          c.title || (msg.role === "user" ? msg.content.slice(0, 60) : c.title),
        updatedAt: Date.now(),
      }));
    },
    [patchConversation]
  );

  const beginStreaming = useCallback(
    (convId: string) => {
      setPhase("streaming");
      setStreamingText("");
      let acc = "";
      cancelRef.current = streamReport(
        convId,
        (token) => {
          acc += token;
          setStreamingText(acc);
        },
        () => {
          setStreamingText("");
          if (acc) {
            appendMessage(convId, { id: uid(), role: "assistant", content: acc });
          }
          setPhase("idle");
          cancelRef.current = null;
        },
        (err) => {
          setError(err.message);
          if (acc) {
            appendMessage(convId, { id: uid(), role: "assistant", content: acc });
          }
          setStreamingText("");
          setPhase("idle");
          cancelRef.current = null;
        }
      ).cancel;
    },
    [appendMessage]
  );

  const handleResponse = useCallback(
    (convId: string, res: ChatResponse) => {
      if (res.status === "pending_review") {
        setFindings(res.findings ?? "");
        setPhase("pending_review");
      } else {
        beginStreaming(convId);
      }
    },
    [beginStreaming]
  );

  const submitQuery = useCallback(
    async (query: string) => {
      if (!activeId || phase !== "idle") return;
      const convId = activeId;
      setError(null);
      appendMessage(convId, { id: uid(), role: "user", content: query });
      setPhase("thinking");
      try {
        const res = await sendQuery(convId, query);
        handleResponse(convId, res);
      } catch (err) {
        setError((err as Error).message);
        setPhase("idle");
      }
    },
    [activeId, phase, appendMessage, handleResponse]
  );

  const decide = useCallback(
    async (approved: boolean) => {
      if (!activeId || phase !== "pending_review") return;
      const convId = activeId;
      setError(null);
      setFindings("");
      setPhase("thinking");
      try {
        const res = await resumeReview(convId, approved);
        handleResponse(convId, res);
      } catch (err) {
        setError((err as Error).message);
        setPhase("idle");
      }
    },
    [activeId, phase, handleResponse]
  );

  const newChat = useCallback(() => {
    if (phase !== "idle") return;
    // Don't stack empty chats: if the active one is unused, stay on it.
    const active = conversations.find((c) => c.id === activeId);
    if (active && active.messages.length === 0) return;
    const c = newConversation();
    setConversations((prev) => [c, ...prev]);
    setActiveId(c.id);
    setFindings("");
    setError(null);
  }, [phase, conversations, activeId]);

  const selectConversation = useCallback(
    (id: string) => {
      if (phase !== "idle" || id === activeId) return;
      cancelRef.current?.();
      cancelRef.current = null;
      setActiveId(id);
      setFindings("");
      setStreamingText("");
      setError(null);
    },
    [phase, activeId]
  );

  const deleteConversation = useCallback(
    (id: string) => {
      if (phase !== "idle") return;
      setConversations((prev) => {
        const remaining = prev.filter((c) => c.id !== id);
        if (remaining.length === 0) {
          const c = newConversation();
          setActiveId(c.id);
          return [c];
        }
        if (id === activeId) setActiveId(remaining[0].id);
        return remaining;
      });
      setFindings("");
      setError(null);
    },
    [phase, activeId]
  );

  return {
    conversations,
    activeId,
    messages,
    phase,
    findings,
    streamingText,
    error,
    submitQuery,
    decide,
    newChat,
    selectConversation,
    deleteConversation,
  };
}
