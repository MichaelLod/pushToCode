"use client";

import { useEffect, useCallback, useState } from "react";
import { Terminal } from "@/components/Terminal";
import { SessionTabs } from "@/components/SessionTabs";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { InputBar } from "@/components/InputBar";
import { FileAttachment } from "@/components/FileUpload";
import { Settings } from "@/components/Settings";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useSessions } from "@/hooks/useSessions";
import { useSettings } from "@/hooks/useSettings";
import { ServerMessage } from "@/types/messages";

export default function Home() {
  const settings = useSettings();
  const [showSettings, setShowSettings] = useState(false);

  // Convert HTTP URL to WebSocket URL if needed
  const wsUrl = settings.serverUrl
    .replace(/^https:\/\//, "wss://")
    .replace(/^http:\/\//, "ws://");

  // WebSocket connection
  const { status, send, isConnected } = useWebSocket({
    url: wsUrl,
    apiKey: settings.apiKey,
    autoConnect: !!settings.serverUrl && !!settings.apiKey,
    onMessage: handleServerMessage,
    onStatusChange: (newStatus) => {
      console.log("WebSocket status:", newStatus);
    },
  });

  // Session management
  const {
    sessions,
    currentSession,
    createSession,
    selectSession,
    removeSession,
  } = useSessions();

  // Create initial session if none exist
  useEffect(() => {
    if (sessions.length === 0 && settings.isLoaded) {
      createSession({ name: "Terminal 1" });
    }
  }, [sessions.length, createSession, settings.isLoaded]);

  // Handle messages from server
  function handleServerMessage(message: ServerMessage) {
    switch (message.type) {
      case "output":
      case "ptyOutput":
        // Write output to terminal - terminal handles this via ref
        console.log("Output:", message.data);
        break;
      case "session_ready":
        console.log("Session ready:", message.sessionId);
        break;
      case "interactiveStarted":
        console.log("Interactive started:", message.sessionId);
        break;
      case "error":
        console.error("Server error:", message.message);
        break;
      case "auth_required":
        console.log("Auth required");
        break;
      case "auth_success":
        console.log("Auth success");
        break;
      case "auth_failed":
        console.error("Auth failed:", message.reason);
        break;
    }
  }

  // Handle user input from InputBar
  const handleSendMessage = useCallback(
    (text: string) => {
      if (!currentSession || !isConnected) return;

      send({
        type: "pty_input",
        sessionId: currentSession.id,
        data: text + "\n",
      });
    },
    [currentSession, isConnected, send]
  );

  // Handle submit from InputBar (text + attachments)
  const handleSubmit = useCallback(
    (text: string, attachments: FileAttachment[]) => {
      if (text.trim()) {
        handleSendMessage(text);
      }
      if (attachments.length > 0) {
        console.log("Attachments:", attachments.map(a => a.file.name));
        // TODO: Handle file uploads
      }
    },
    [handleSendMessage]
  );

  // Handle terminal input (keystrokes)
  const handleTerminalInput = useCallback(
    (data: string) => {
      if (!currentSession || !isConnected) return;

      send({
        type: "pty_input",
        sessionId: currentSession.id,
        data,
      });
    },
    [currentSession, isConnected, send]
  );

  // Handle new session
  const handleNewSession = useCallback(() => {
    createSession({ name: `Terminal ${sessions.length + 1}` });
  }, [createSession, sessions.length]);

  // Show settings if not configured
  const needsConfig = !settings.serverUrl || !settings.apiKey;

  return (
    <div className="flex h-screen flex-col bg-bg-primary">
      {/* Header */}
      <header className="flex h-12 items-center justify-between border-b border-border px-4">
        <h1 className="text-lg font-semibold text-text-primary">pushToCode</h1>
        <div className="flex items-center gap-4">
          <ConnectionStatus status={status} />
          <button
            onClick={() => setShowSettings(true)}
            className="text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar with session tabs */}
        <aside className="hidden w-64 flex-col border-r border-border bg-bg-secondary md:flex">
          <SessionTabs
            sessions={sessions}
            currentSessionId={currentSession?.id ?? null}
            onSelectSession={selectSession}
            onCloseSession={removeSession}
            onAddSession={handleNewSession}
          />
        </aside>

        {/* Terminal area */}
        <div className="flex flex-1 flex-col">
          {/* Show config prompt if not configured */}
          {needsConfig ? (
            <div className="flex flex-1 items-center justify-center p-4">
              <div className="text-center">
                <p className="text-text-secondary mb-4">
                  Configure your server URL and API key to get started
                </p>
                <button
                  onClick={() => setShowSettings(true)}
                  className="rounded-lg bg-accent px-4 py-2 text-bg-primary font-medium hover:opacity-90 transition-opacity"
                >
                  Open Settings
                </button>
              </div>
            </div>
          ) : currentSession ? (
            <div className="flex-1 min-h-0">
              <Terminal
                sessionId={currentSession.id}
                onInput={handleTerminalInput}
                fontSize={settings.fontSize}
                fontFamily={settings.fontFamily}
              />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-text-secondary">No active session</p>
            </div>
          )}

          {/* Input area */}
          <div className="border-t border-border">
            <InputBar
              onSubmit={handleSubmit}
              onKeyPress={handleTerminalInput}
              disabled={!isConnected || !currentSession}
              placeholder={
                !isConnected
                  ? "Connecting..."
                  : !currentSession
                  ? "No session"
                  : "Enter command..."
              }
            />
          </div>
        </div>
      </main>

      {/* Settings panel */}
      {showSettings && (
        <Settings
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
