"use client";

import { useState } from "react";
import { AlertTriangle, Menu } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import MessageList from "@/components/MessageList";
import ChatInput from "@/components/ChatInput";
import { useResearchChat } from "@/lib/useResearchChat";

export default function Home() {
  const {
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
  } = useResearchChat();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [docsRefreshKey, setDocsRefreshKey] = useState(0);

  const handleNewChat = () => {
    newChat();
    setSidebarOpen(false);
  };

  const handleSelect = (id: string) => {
    selectConversation(id);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        conversations={conversations}
        activeId={activeId}
        onNewChat={handleNewChat}
        onSelect={handleSelect}
        onDelete={deleteConversation}
        busy={phase !== "idle"}
        refreshKey={docsRefreshKey}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center gap-3 border-b border-surface-border px-4 py-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-ink"
            aria-label="Open sidebar"
          >
            <Menu size={22} />
          </button>
          <span className="font-semibold text-ink">Research Agent</span>
        </header>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 border-b border-accent/40 bg-accent/15 px-4 py-2 text-sm text-accent-dark">
            <AlertTriangle size={16} className="shrink-0 text-accent" />
            <span className="truncate">{error}</span>
          </div>
        )}

        {/* Conversation */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          <MessageList
            messages={messages}
            phase={phase}
            findings={findings}
            streamingText={streamingText}
            onDecide={decide}
            onSuggestion={submitQuery}
          />
        </main>

        {/* Input */}
        <ChatInput
          phase={phase}
          onSubmit={submitQuery}
          onUploaded={() => setDocsRefreshKey((k) => k + 1)}
        />
      </div>
    </div>
  );
}
