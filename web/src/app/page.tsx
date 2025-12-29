"use client";

import { useEffect, useCallback, useState, useRef } from "react";
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
import { InstallBanner } from "@/components/InstallBanner";

export default function Home() {
  const settings = useSettings();
  const [showSettings, setShowSettings] = useState(false);
  const initializedSessionsRef = useRef<Set<string>>(new Set());
  const [sessionReinitTrigger, setSessionReinitTrigger] = useState(0);

  // Convert HTTP URL to WebSocket URL if needed
  const wsUrl = settings.serverUrl
    .replace(/^https:\/\//, "wss://")
    .replace(/^http:\/\//, "ws://");

  // Session management
  const {
    sessions,
    currentSession,
    createSession,
    selectSession,
    removeSession,
  } = useSessions();

  // Terminal for current session - need to get write function
  const terminalWriteRef = useRef<((data: string) => void) | null>(null);

  // Handle messages from server
  const handleServerMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case "output":
        // Write output to terminal
        if (message.content) {
          terminalWriteRef.current?.(message.content);
        }
        break;
      case "pty_output":
        // Write PTY output to terminal
        if (message.content) {
          terminalWriteRef.current?.(message.content);
        }
        break;
      case "session_ready":
        console.log("Session ready:", message.sessionId);
        break;
      case "interactive_started":
        console.log("Interactive started:", message.sessionId);
        break;
      case "status":
        console.log("Status:", message.sessionId, message.status);
        break;
      case "error":
        console.error("Server error:", message.message);
        // Handle stale session error - clear and re-initialize
        if (message.message?.includes("No active PTY session") ||
            message.message?.includes("Session not found")) {
          console.log("Session expired, re-initializing...");
          // Clear the initialized sessions and trigger re-init
          initializedSessionsRef.current.clear();
          setSessionReinitTrigger(prev => prev + 1);
        }
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
      case "login_interactive":
        console.log("Login interactive:", message.message);
        break;
      case "file_uploaded":
        console.log("File uploaded:", message.filePath);
        break;
      case "ping":
      case "pong":
        // Handled by websocket client
        break;
    }
  }, []);

  // Track previous connection status for reconnect detection
  const prevStatusRef = useRef<string>("disconnected");

  // WebSocket connection
  const { status, send, isConnected } = useWebSocket({
    url: wsUrl,
    apiKey: settings.apiKey,
    autoConnect: !!settings.serverUrl && !!settings.apiKey,
    onMessage: handleServerMessage,
    onStatusChange: (newStatus) => {
      console.log("WebSocket status:", newStatus);
      // Clear initialized sessions on reconnect (was disconnected, now connected)
      if (newStatus === "connected" && prevStatusRef.current !== "connected") {
        console.log("WebSocket reconnected, clearing session state");
        initializedSessionsRef.current.clear();
      }
      prevStatusRef.current = newStatus;
    },
  });

  // Create initial session if none exist
  useEffect(() => {
    if (sessions.length === 0 && settings.isLoaded) {
      createSession({ name: "Terminal 1" });
    }
  }, [sessions.length, createSession, settings.isLoaded]);

  // Start interactive session on backend when connected
  // Also re-initializes when sessionReinitTrigger changes (after session expiry)
  useEffect(() => {
    if (isConnected && currentSession && !initializedSessionsRef.current.has(currentSession.id)) {
      console.log("Starting interactive session:", currentSession.id);
      initializedSessionsRef.current.add(currentSession.id);

      send({
        type: "start_interactive",
        sessionId: currentSession.id,
        projectPath: currentSession.repoPath || "/repos", // Default to /repos
      });
    }
  }, [isConnected, currentSession, send, sessionReinitTrigger]);

  // Handle user input from InputBar
  const handleSendMessage = useCallback(
    (text: string) => {
      if (!currentSession || !isConnected) return;

      // Send text first, then Enter separately (Claude CLI needs separate keypress)
      send({
        type: "pty_input",
        sessionId: currentSession.id,
        data: text,
      });
      send({
        type: "pty_input",
        sessionId: currentSession.id,
        data: "\r",
      });
    },
    [currentSession, isConnected, send]
  );

  // Helper to convert file to base64
  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/png;base64,")
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  // Handle submit from InputBar (text + attachments)
  const handleSubmit = useCallback(
    async (text: string, attachments: FileAttachment[]) => {
      if (!currentSession || !isConnected) return;

      // Upload files first
      const uploadedPaths: string[] = [];
      for (const attachment of attachments) {
        try {
          const base64Data = await fileToBase64(attachment.file);
          send({
            type: "upload_file",
            sessionId: currentSession.id,
            filename: attachment.file.name,
            mimeType: attachment.file.type,
            data: base64Data,
          });
          // We'll include a reference to the file in the message
          // The actual path will be logged when file_uploaded is received
          uploadedPaths.push(attachment.file.name);
        } catch (err) {
          console.error("Failed to upload file:", err);
        }
      }

      // Build message with file references
      let message = text.trim();
      if (uploadedPaths.length > 0) {
        const fileNote = `[Attached: ${uploadedPaths.join(", ")} - files saved to /tmp/pushtocode-uploads/]`;
        message = message ? `${message}\n\n${fileNote}` : fileNote;
      }

      if (message) {
        handleSendMessage(message);
      }
    },
    [currentSession, isConnected, send, fileToBase64, handleSendMessage]
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

  // Show loading state until settings are loaded (prevents hydration mismatch)
  if (!settings.isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-bg-primary">
      {/* Header - with safe area padding for PWA mode */}
      <header className="flex min-h-12 items-center justify-between border-b border-border px-4 pt-[env(safe-area-inset-top)]">
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
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Horizontal session tabs */}
        <SessionTabs
          sessions={sessions}
          currentSessionId={currentSession?.id ?? null}
          onSelectSession={selectSession}
          onCloseSession={removeSession}
          onAddSession={handleNewSession}
        />

        {/* Terminal area */}
        <div className="flex flex-1 flex-col min-h-0">
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
                onReady={(terminal) => {
                  terminalWriteRef.current = terminal.write;
                }}
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
              serverUrl={settings.serverUrl}
              apiKey={settings.apiKey}
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

      {/* PWA Install Banner */}
      <InstallBanner />
    </div>
  );
}
