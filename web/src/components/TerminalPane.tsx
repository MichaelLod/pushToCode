"use client";

/**
 * TerminalPane - A terminal with its own dedicated WebSocket connection
 * Each terminal session gets its own WebSocket, making session management simpler
 */

import { useEffect, useCallback, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Terminal } from "@/components/Terminal";
import { useWebSocket, ConnectionStatus } from "@/hooks/useWebSocket";
import { useTerminal } from "@/hooks/useTerminal";
import { ServerMessage, TerminalBufferMessage, SessionResumedMessage } from "@/types/messages";
import { FileAttachment } from "@/components/FileUpload";
import {
  appendTerminalOutput,
  getTerminalOutput,
  setTerminalOutput,
} from "@/lib/storage";

export interface TerminalPaneProps {
  sessionId: string;
  repoPath?: string;
  serverUrl: string;
  apiKey: string;
  isActive?: boolean; // Whether this terminal tab is currently visible
  onStatusChange?: (status: ConnectionStatus) => void;
  fontSize?: number;
  fontFamily?: string;
}

export interface TerminalPaneHandle {
  focus: () => void;
  sendInput: (data: string) => void;
  sendTranscription: (text: string) => void;
  uploadFiles: (attachments: FileAttachment[]) => Promise<void>;
  getStatus: () => ConnectionStatus;
  isConnected: () => boolean;
  destroySession: () => void;  // Notify backend to destroy session (for X button)
}

export const TerminalPane = forwardRef<TerminalPaneHandle, TerminalPaneProps>(
  function TerminalPane(
    {
      sessionId,
      repoPath,
      serverUrl,
      apiKey,
      isActive = true,
      onStatusChange,
      fontSize = 14,
      fontFamily = "monospace",
    },
    ref
  ) {
    // Track initialization state
    const [isSessionReady, setIsSessionReady] = useState(false);
    const hasRestoredOutputRef = useRef(false);
    const useBufferModeRef = useRef(false);
    const lastBufferContentRef = useRef<string>("");
    const pendingUploadsRef = useRef<Map<string, (path: string) => void>>(new Map());
    const wasConnectedRef = useRef(false); // Track previous connection state for reconnect handling
    const isResumingRef = useRef(false); // Track if we're waiting for resume response

    // Terminal write/focus/fit refs
    const terminalWriteRef = useRef<((data: string) => void) | null>(null);
    const terminalFocusRef = useRef<(() => void) | null>(null);
    const terminalFitRef = useRef<(() => void) | null>(null);

    // Convert HTTP URL to WebSocket URL
    const wsUrl = serverUrl
      .replace(/^https:\/\//, "wss://")
      .replace(/^http:\/\//, "ws://");

    // Handle messages from this session's WebSocket
    const handleMessage = useCallback((message: ServerMessage) => {
      switch (message.type) {
        case "output":
          if (message.content) {
            terminalWriteRef.current?.(message.content);
            appendTerminalOutput(sessionId, message.content);
          }
          break;

        case "pty_output":
          // Legacy mode - only use if not in buffer mode
          if (!useBufferModeRef.current && message.content) {
            terminalWriteRef.current?.(message.content);
            appendTerminalOutput(sessionId, message.content);
          }
          break;

        case "terminal_buffer":
          // Server-side rendered buffer - switch to buffer mode
          useBufferModeRef.current = true;
          const buffer = (message as TerminalBufferMessage).buffer;
          if (buffer) {
            const content = buffer.ansiContent ?? buffer.lines.join("\n");
            // Only update if content actually changed to prevent flickering
            if (content !== lastBufferContentRef.current) {
              lastBufferContentRef.current = content;
              // \x1b[H = cursor home, \x1b[2J = clear screen, \x1b[3J = clear scrollback
              terminalWriteRef.current?.("\x1b[H\x1b[2J\x1b[3J" + content);
              // Use the same storage function as legacy mode for consistency
              setTerminalOutput(sessionId, content);
            }
          }
          break;

        case "interactive_started":
          console.log(`[${sessionId}] Interactive session started`);
          setIsSessionReady(true);
          break;

        case "session_resumed":
          // Successfully resumed existing session
          console.log(`[${sessionId}] Session resumed, PTY running: ${(message as SessionResumedMessage).isRunning}`);
          isResumingRef.current = false;
          useBufferModeRef.current = true;

          // Display the resumed buffer content
          const resumedBuffer = (message as SessionResumedMessage).buffer;
          if (resumedBuffer) {
            const content = resumedBuffer.ansiContent ?? resumedBuffer.lines.join("\n");
            if (content) {
              lastBufferContentRef.current = content;
              // \x1b[H = cursor home, \x1b[2J = clear screen, \x1b[3J = clear scrollback
              terminalWriteRef.current?.("\x1b[H\x1b[2J\x1b[3J" + content);
              setTerminalOutput(sessionId, content);
            }
          }
          setIsSessionReady(true);
          break;

        case "session_not_found":
          // Session doesn't exist on backend, start a new one
          console.log(`[${sessionId}] Session not found, starting new interactive session`);
          isResumingRef.current = false;
          send({
            type: "start_interactive",
            sessionId,
            projectPath: repoPath || "/repos",
          });
          break;

        case "session_destroyed":
          console.log(`[${sessionId}] Session destroyed by server`);
          break;

        case "session_ready":
          console.log(`[${sessionId}] Session ready`);
          break;

        case "error":
          console.error(`[${sessionId}] Error:`, message.message);
          // On session error, mark as not ready to trigger re-init
          if (message.message?.includes("No active PTY session") ||
              message.message?.includes("Session not found") ||
              message.message?.includes("pty") ||
              message.message?.includes("session")) {
            console.log(`[${sessionId}] Session error detected, will re-init`);
            setIsSessionReady(false);
            // Reset buffer state so fresh data can come in
            useBufferModeRef.current = false;
            lastBufferContentRef.current = "";
          }
          break;

        case "file_uploaded":
          console.log(`[${sessionId}] File uploaded:`, message.filePath);
          if (message.filename && message.filePath) {
            const resolver = pendingUploadsRef.current.get(message.filename);
            if (resolver) {
              resolver(message.filePath);
              pendingUploadsRef.current.delete(message.filename);
            }
          }
          break;

        case "auth_required":
        case "auth_success":
        case "auth_failed":
        case "login_interactive":
        case "ping":
        case "pong":
          // Handled by WebSocket client or ignored
          break;
      }
    }, [sessionId]);

    // WebSocket connection for this terminal
    const { status, isConnected, send, checkConnection } = useWebSocket({
      url: wsUrl,
      apiKey,
      sessionId,
      autoConnect: !!serverUrl && !!apiKey,
      onMessage: handleMessage,
      onStatusChange,
    });

    // Handle connection state changes - reset on reconnect
    useEffect(() => {
      if (isConnected && !wasConnectedRef.current) {
        // Just reconnected - reset state to try resuming
        console.log(`[${sessionId}] Connection established, will try to resume`);
        useBufferModeRef.current = false;
        lastBufferContentRef.current = "";
        isResumingRef.current = false; // Reset so we try to resume
        setIsSessionReady(false); // Trigger resume attempt
      }
      wasConnectedRef.current = isConnected;
    }, [isConnected, sessionId]);

    // Try to resume session when connected, fall back to starting new one
    useEffect(() => {
      if (!isConnected || isSessionReady || isResumingRef.current) return;

      console.log(`[${sessionId}] Attempting to resume session, path:`, repoPath || "/repos");

      // Mark that we're waiting for resume response
      isResumingRef.current = true;

      // Try to resume existing session first
      // If session_not_found is received, the handler will start a new session
      send({
        type: "resume_session",
        sessionId,
        projectPath: repoPath || "/repos",
      });
    }, [isConnected, isSessionReady, sessionId, repoPath, send]);

    // Handle visibility change (PWA resume from background)
    useEffect(() => {
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          console.log(`[${sessionId}] App became visible, checking connection...`);
          checkConnection();

          // Re-focus terminal
          setTimeout(() => {
            terminalFocusRef.current?.();
          }, 100);

          // Verify session is still alive
          if (isSessionReady) {
            const sent = send({
              type: "pty_input",
              sessionId,
              data: "", // Empty ping
            });
            if (!sent) {
              console.log(`[${sessionId}] Connection dead, will re-init`);
              setIsSessionReady(false);
            }
          }
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }, [sessionId, isSessionReady, checkConnection, send]);

    // Handle terminal input
    const handleTerminalInput = useCallback((data: string) => {
      if (!isConnected || !isSessionReady) return;

      send({
        type: "pty_input",
        sessionId,
        data,
      });
    }, [isConnected, isSessionReady, sessionId, send]);

    // Helper to convert file to base64
    const fileToBase64 = useCallback((file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }, []);

    // Handle file uploads
    const handleFileUpload = useCallback(async (attachments: FileAttachment[]) => {
      if (!isConnected) return;

      const uploadedPaths: string[] = [];

      for (const attachment of attachments) {
        try {
          const base64Data = await fileToBase64(attachment.file);
          const filename = attachment.file.name;

          // Wait for server response with actual path
          const pathPromise = new Promise<string>((resolve) => {
            const timeout = setTimeout(() => {
              pendingUploadsRef.current.delete(filename);
              resolve(`/tmp/pushtocode-uploads/${filename}`);
            }, 5000);

            pendingUploadsRef.current.set(filename, (path: string) => {
              clearTimeout(timeout);
              resolve(path);
            });
          });

          send({
            type: "upload_file",
            sessionId,
            filename,
            mimeType: attachment.file.type,
            data: base64Data,
          });

          const actualPath = await pathPromise;
          uploadedPaths.push(actualPath);
        } catch (err) {
          console.error(`[${sessionId}] Failed to upload file:`, err);
        }
      }

      // Send file reference to terminal
      if (uploadedPaths.length > 0) {
        const fileNote = `[Attached files: ${uploadedPaths.join(", ")}]`;
        send({
          type: "pty_input",
          sessionId,
          data: fileNote + "\r",
        });
      }

      terminalFocusRef.current?.();
    }, [isConnected, sessionId, send, fileToBase64]);

    // Handle terminal ready
    const handleTerminalReady = useCallback((terminal: ReturnType<typeof useTerminal>) => {
      terminalWriteRef.current = terminal.write;
      terminalFocusRef.current = terminal.focus;
      terminalFitRef.current = terminal.fit;

      // Restore persisted output once
      if (!hasRestoredOutputRef.current) {
        const savedOutput = getTerminalOutput(sessionId);
        if (savedOutput) {
          terminal.write(savedOutput);
          lastBufferContentRef.current = savedOutput; // Sync ref to prevent flicker
        }
        hasRestoredOutputRef.current = true;
      }

      // Auto-focus if active
      if (isActive) {
        terminal.focus();
      }
    }, [sessionId, isActive]);

    // Re-fit terminal when it becomes active (fixes dimension calculation for hidden tabs)
    useEffect(() => {
      if (isActive) {
        // Small delay to ensure visibility change has taken effect
        const timer = setTimeout(() => {
          terminalFitRef.current?.();
          terminalFocusRef.current?.();
        }, 50);
        return () => clearTimeout(timer);
      }
    }, [isActive]);

    // Send transcription text
    const sendTranscription = useCallback((text: string) => {
      if (!isConnected) return;

      send({
        type: "pty_input",
        sessionId,
        data: text + "\r",
      });

      terminalFocusRef.current?.();
    }, [isConnected, sessionId, send]);

    // Destroy session on backend (for X button)
    const destroySession = useCallback(() => {
      console.log(`[${sessionId}] Destroying session`);
      send({
        type: "destroy_session",
        sessionId,
      });
    }, [sessionId, send]);

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      focus: () => terminalFocusRef.current?.(),
      sendInput: (data: string) => handleTerminalInput(data),
      sendTranscription,
      uploadFiles: handleFileUpload,
      getStatus: () => status,
      isConnected: () => isConnected,
      destroySession,
    }), [handleTerminalInput, sendTranscription, handleFileUpload, status, isConnected, destroySession]);

    // Show loading state while connecting or initializing
    const isLoading = !isConnected || !isSessionReady;
    const loadingMessage = !isConnected
      ? status === "connecting" ? "Connecting..." : "Disconnected"
      : "Starting session...";

    return (
      <div className="relative h-full">
        <Terminal
          sessionId={sessionId}
          onInput={handleTerminalInput}
          onReady={handleTerminalReady}
          fontSize={fontSize}
          fontFamily={fontFamily}
          className="h-full"
        />

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1a1b26]/95 z-10">
            <div className="flex flex-col items-center gap-4">
              {/* Claude-style spinner - three pulsing dots */}
              <div className="flex items-center gap-2">
                <div className="loading-dot w-3 h-3 rounded-full bg-[#7aa2f7]" />
                <div className="loading-dot w-3 h-3 rounded-full bg-[#7aa2f7]" />
                <div className="loading-dot w-3 h-3 rounded-full bg-[#7aa2f7]" />
              </div>
              <p className="text-[#a9b1d6] text-sm">{loadingMessage}</p>
            </div>
          </div>
        )}
      </div>
    );
  }
);

export default TerminalPane;
