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
import { ServerMessage, TerminalBufferMessage } from "@/types/messages";
import { InstallBanner } from "@/components/InstallBanner";
import { NewSessionModal } from "@/components/NewSessionModal";
import {
  appendTerminalOutput,
  getTerminalOutput,
} from "@/lib/storage";

export default function Home() {
  const settings = useSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const initializedSessionsRef = useRef<Set<string>>(new Set());
  // Track pending file uploads to get actual paths from server
  const pendingUploadsRef = useRef<Map<string, (path: string) => void>>(new Map());
  const [sessionReinitTrigger, setSessionReinitTrigger] = useState(0);
  const sessionInitInProgressRef = useRef<string | null>(null);
  const lastInitTimeRef = useRef<number>(0);

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

  // Terminal for current session - need to get write, focus, and clear functions
  const terminalWriteRef = useRef<((data: string) => void) | null>(null);
  const terminalFocusRef = useRef<(() => void) | null>(null);
  const terminalClearRef = useRef<(() => void) | null>(null);
  // Track which sessions have had their output restored
  const restoredSessionsRef = useRef<Set<string>>(new Set());
  // Track if we're using server-side buffer mode (disables legacy pty_output handling)
  const useBufferModeRef = useRef<boolean>(false);

  // Handle messages from server
  const handleServerMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case "output":
        // Write output to terminal and persist
        if (message.content) {
          terminalWriteRef.current?.(message.content);
          if (message.sessionId) {
            appendTerminalOutput(message.sessionId, message.content);
          }
        }
        break;
      case "pty_output":
        // Legacy: Write raw PTY output to terminal (only if not using buffer mode)
        // When server supports buffer mode, this is disabled to prevent duplicate rendering
        if (!useBufferModeRef.current && message.content) {
          terminalWriteRef.current?.(message.content);
          if (message.sessionId) {
            appendTerminalOutput(message.sessionId, message.content);
          }
        }
        break;
      case "terminal_buffer":
        // Server-side rendered terminal buffer - render the complete terminal state
        // This fixes the multiline spam issue by receiving complete terminal snapshots
        useBufferModeRef.current = true; // Switch to buffer mode, disable pty_output handling
        if ((message as TerminalBufferMessage).buffer) {
          const buffer = (message as TerminalBufferMessage).buffer;
          // Use ANSI content with colors if available, otherwise fall back to plain lines
          // Prepend cursor home + clear screen to avoid flicker from separate clear() call
          const content = buffer.ansiContent ?? buffer.lines.join("\n");
          // Use ANSI escape codes: \x1b[H = cursor home, \x1b[2J = clear screen
          // This is smoother than calling clear() separately because it's a single write
          terminalWriteRef.current?.("\x1b[H\x1b[2J" + content);
          // Persist the buffer content (with ANSI codes for color restoration)
          if (message.sessionId) {
            // Store the complete buffer (replace, not append)
            localStorage.setItem(`terminal_output_${message.sessionId}`, content);
          }
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
        console.log("File uploaded:", message.filePath, "original:", message.filename);
        // Resolve pending upload promise with actual path
        if (message.filename && message.filePath) {
          const resolver = pendingUploadsRef.current.get(message.filename);
          if (resolver) {
            resolver(message.filePath);
            pendingUploadsRef.current.delete(message.filename);
          }
        }
        break;
      case "ping":
      case "pong":
        // Handled by websocket client
        break;
    }
  }, []);

  // Track previous connection status for reconnect detection
  const prevStatusRef = useRef<string>("disconnected");
  // Track when we last disconnected (to distinguish real reconnects from Strict Mode)
  const lastDisconnectTimeRef = useRef<number>(0);
  const STRICT_MODE_RECONNECT_THRESHOLD = 500; // ms - Strict Mode reconnects faster than this

  // WebSocket connection
  const { status, send, isConnected, checkConnection } = useWebSocket({
    url: wsUrl,
    apiKey: settings.apiKey,
    autoConnect: !!settings.serverUrl && !!settings.apiKey,
    onMessage: handleServerMessage,
    onStatusChange: (newStatus) => {
      const now = Date.now();
      const timeSinceDisconnect = now - lastDisconnectTimeRef.current;
      console.log("WebSocket status:", newStatus, "prev:", prevStatusRef.current, "timeSinceDisconnect:", timeSinceDisconnect);

      if (newStatus === "disconnected" && prevStatusRef.current === "connected") {
        // Track disconnect time
        lastDisconnectTimeRef.current = now;
      }

      // Only clear sessions on REAL reconnect (not React Strict Mode remount)
      // Strict Mode reconnects happen within ~100ms, real reconnects take longer
      if (newStatus === "connected" && prevStatusRef.current === "disconnected") {
        if (lastDisconnectTimeRef.current > 0 && timeSinceDisconnect > STRICT_MODE_RECONNECT_THRESHOLD) {
          // This is a real reconnect after a real disconnect (not Strict Mode)
          console.log("WebSocket reconnected after real disconnect, clearing session state");
          initializedSessionsRef.current.clear();
          restoredSessionsRef.current.clear(); // Allow terminal output to be restored
          lastInitTimeRef.current = 0; // Reset debounce timer
        } else {
          console.log("Ignoring fast reconnect (likely Strict Mode)");
        }
      }
      prevStatusRef.current = newStatus;
    },
  });

  // On fresh page load, clear initialized sessions to force re-init on backend
  // This ensures restored sessions from localStorage get their PTY respawned
  useEffect(() => {
    console.log("Fresh page load - clearing session init state for recovery");
    initializedSessionsRef.current.clear();
    restoredSessionsRef.current.clear();
    lastInitTimeRef.current = 0;
  }, []); // Empty deps = runs once on mount

  // Create initial session if none exist
  useEffect(() => {
    if (sessions.length === 0 && settings.isLoaded) {
      createSession({ name: "Terminal 1" });
    }
  }, [sessions.length, createSession, settings.isLoaded]);

  // Handle app visibility change (PWA resume from background)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("App became visible, checking connection...");

        // Check if WebSocket connection is still alive (iOS may have killed it)
        // This will reconnect if the socket is stale
        checkConnection();

        // Re-focus terminal when app comes back
        setTimeout(() => {
          terminalFocusRef.current?.();
        }, 100);

        // If we have a session, verify it's still active on the server
        if (currentSession) {
          const sessionId = currentSession.id;
          if (initializedSessionsRef.current.has(sessionId)) {
            console.log("Sending ping to verify session is alive...");
            // Send a ping to test the connection - if session is dead,
            // the server will respond with an error which triggers re-init
            // via handleServerMessage's error handler
            const sent = send({
              type: "pty_input",
              sessionId: sessionId,
              data: "", // Empty input just to test connection
            });
            if (!sent) {
              // Message couldn't be sent - connection is definitely dead
              // Clear session state to force re-initialization
              console.log("Connection dead, clearing session state for re-init");
              initializedSessionsRef.current.delete(sessionId);
              restoredSessionsRef.current.delete(sessionId);
              lastInitTimeRef.current = 0;
              setSessionReinitTrigger(prev => prev + 1);
            }
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentSession, checkConnection, send]);

  // Start interactive session on backend when connected
  // Also re-initializes when sessionReinitTrigger changes (after session expiry)
  // Debounced to prevent duplicate initialization on mobile (min 2s between inits)
  useEffect(() => {
    if (!isConnected || !currentSession) return;

    const sessionId = currentSession.id;
    const now = Date.now();
    const timeSinceLastInit = now - lastInitTimeRef.current;
    const MIN_INIT_INTERVAL = 2000; // 2 seconds minimum between initializations

    // Skip if already initialized
    if (initializedSessionsRef.current.has(sessionId)) {
      return;
    }

    // Skip if init is in progress for this session
    if (sessionInitInProgressRef.current === sessionId) {
      console.log("Session init already in progress, skipping:", sessionId);
      return;
    }

    // Debounce: skip if initialized too recently (prevents rapid reconnect duplicates)
    if (timeSinceLastInit < MIN_INIT_INTERVAL) {
      console.log("Session init debounced, too soon:", timeSinceLastInit, "ms since last init");
      return;
    }

    console.log("Starting interactive session:", sessionId);

    // Mark as in progress and update last init time
    sessionInitInProgressRef.current = sessionId;
    lastInitTimeRef.current = now;

    // Reset buffer mode for new session (will be set to true when first buffer arrives)
    useBufferModeRef.current = false;

    // Note: We no longer clear the terminal here because:
    // 1. Terminal output is now persisted to localStorage
    // 2. Output is restored when terminal mounts (via restoredSessionsRef)
    // 3. Backend uses --resume which doesn't replay old output

    initializedSessionsRef.current.add(sessionId);

    send({
      type: "start_interactive",
      sessionId: sessionId,
      projectPath: currentSession.repoPath || "/repos", // Default to /repos
    });

    // Clear in-progress flag after a short delay
    setTimeout(() => {
      if (sessionInitInProgressRef.current === sessionId) {
        sessionInitInProgressRef.current = null;
      }
    }, 1000);
  }, [isConnected, currentSession, send, sessionReinitTrigger]);

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

  // Handle voice transcription - send to terminal and press enter
  const handleTranscription = useCallback(
    (text: string) => {
      if (!currentSession || !isConnected) return;

      // Send transcribed text then Enter
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

      // Refocus terminal after transcription
      terminalFocusRef.current?.();
    },
    [currentSession, isConnected, send]
  );

  // Handle file uploads from InputBar
  const handleFileUpload = useCallback(
    async (attachments: FileAttachment[]) => {
      if (!currentSession || !isConnected) return;

      // Upload files and wait for actual paths from server
      const uploadedPaths: string[] = [];
      for (const attachment of attachments) {
        try {
          const base64Data = await fileToBase64(attachment.file);
          const filename = attachment.file.name;

          // Create promise to wait for server response with actual path
          const pathPromise = new Promise<string>((resolve) => {
            // Set a timeout in case server doesn't respond
            const timeout = setTimeout(() => {
              pendingUploadsRef.current.delete(filename);
              resolve(`/tmp/pushtocode-uploads/${filename}`); // Fallback to original name
            }, 5000);

            pendingUploadsRef.current.set(filename, (path: string) => {
              clearTimeout(timeout);
              resolve(path);
            });
          });

          // Send upload request
          send({
            type: "upload_file",
            sessionId: currentSession.id,
            filename: filename,
            mimeType: attachment.file.type,
            data: base64Data,
          });

          // Wait for actual path from server
          const actualPath = await pathPromise;
          uploadedPaths.push(actualPath);
          console.log("File uploaded, actual path:", actualPath);
        } catch (err) {
          console.error("Failed to upload file:", err);
        }
      }

      // Send file reference message to terminal with ACTUAL paths
      if (uploadedPaths.length > 0) {
        const fileNote = `[Attached files: ${uploadedPaths.join(", ")}]`;
        send({
          type: "pty_input",
          sessionId: currentSession.id,
          data: fileNote,
        });
        send({
          type: "pty_input",
          sessionId: currentSession.id,
          data: "\r",
        });
      }

      // Refocus terminal
      terminalFocusRef.current?.();
    },
    [currentSession, isConnected, send, fileToBase64]
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

  // Handle new session - show modal to select project
  const handleNewSession = useCallback(() => {
    setShowNewSessionModal(true);
  }, []);

  // Create session with selected project
  const handleCreateSessionWithRepo = useCallback(
    (repoPath: string, repoName: string) => {
      createSession({
        name: repoName,
        repoPath: repoPath,
      });
      setShowNewSessionModal(false);
    },
    [createSession]
  );

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
        <h1 className="text-lg font-semibold text-text-primary">pushToCode v2</h1>
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
                  terminalFocusRef.current = terminal.focus;
                  terminalClearRef.current = terminal.clear;

                  // Restore persisted output if not already restored for this session
                  const sessionId = currentSession.id;
                  if (!restoredSessionsRef.current.has(sessionId)) {
                    const savedOutput = getTerminalOutput(sessionId);
                    if (savedOutput) {
                      terminal.write(savedOutput);
                    }
                    restoredSessionsRef.current.add(sessionId);
                  }

                  // Auto-focus terminal when ready
                  terminal.focus();
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

          {/* Toolbar with action buttons */}
          <InputBar
            onKeyPress={handleTerminalInput}
            onTranscription={handleTranscription}
            onFileUpload={handleFileUpload}
            disabled={!isConnected || !currentSession}
            serverUrl={settings.serverUrl}
            apiKey={settings.apiKey}
          />
        </div>
      </main>

      {/* Settings panel */}
      {showSettings && (
        <Settings
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* New Session Modal */}
      <NewSessionModal
        isOpen={showNewSessionModal}
        onClose={() => setShowNewSessionModal(false)}
        onConfirm={handleCreateSessionWithRepo}
      />

      {/* PWA Install Banner */}
      <InstallBanner />
    </div>
  );
}
