import type {
  ChatResponse,
  DocumentList,
  NewChatResponse,
} from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Request to ${path} failed (${res.status})${detail ? `: ${detail}` : ""}`
    );
  }
  return res.json() as Promise<T>;
}

/** Start a fresh conversation thread. */
export function createThread(): Promise<NewChatResponse> {
  return jsonFetch<NewChatResponse>("/api/new-chat", { method: "POST" });
}

/** Submit a research query. May return pending_review (human-in-the-loop). */
export function sendQuery(
  threadId: string,
  query: string
): Promise<ChatResponse> {
  return jsonFetch<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ thread_id: threadId, query }),
  });
}

/** Resume after human review: approve (generate report) or search more. */
export function resumeReview(
  threadId: string,
  approved: boolean
): Promise<ChatResponse> {
  return jsonFetch<ChatResponse>("/api/resume", {
    method: "POST",
    body: JSON.stringify({ thread_id: threadId, approved }),
  });
}

/** List PDFs currently in the knowledge base. */
export function listDocuments(): Promise<DocumentList> {
  return jsonFetch<DocumentList>("/api/documents", { method: "GET" });
}

/** Upload a PDF to the knowledge base; returns how many chunks were indexed. */
export async function uploadDocument(
  file: File
): Promise<{ filename: string; chunks: number }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/api/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }
  return res.json();
}

/**
 * Stream the final report token-by-token over SSE.
 *
 * The backend emits `data:` events with text chunks and an `event: done`
 * (or a `[DONE]` sentinel) to close the stream. We use fetch + a ReadableStream
 * reader rather than the native EventSource so we can POST/keep flexibility and
 * parse manually.
 *
 * @returns an async function you can `await` for completion. Call the returned
 *          `cancel` to abort early.
 */
export function streamReport(
  threadId: string,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (err: Error) => void
): { cancel: () => void } {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/stream?thread_id=${encodeURIComponent(threadId)}`,
        {
          method: "GET",
          headers: { Accept: "text/event-stream" },
          signal: controller.signal,
        }
      );
      if (!res.ok || !res.body) {
        throw new Error(`Stream failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const lines = frame.split("\n");
          let eventType = "message";
          const dataParts: string[] = [];
          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataParts.push(line.slice(5).replace(/^ /, ""));
            }
          }
          const data = dataParts.join("\n");

          if (eventType === "done" || data === "[DONE]") {
            onDone();
            return;
          }
          if (eventType === "error") {
            throw new Error(data || "Stream error");
          }
          if (data) {
            onToken(data);
          }
        }
      }
      onDone();
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      onError(err as Error);
    }
  })();

  return { cancel: () => controller.abort() };
}
