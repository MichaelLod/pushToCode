"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { TerminalPane, TerminalPaneHandle } from "@/components/TerminalPane";
import { SessionTabs } from "@/components/SessionTabs";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { InputBar } from "@/components/InputBar";
import { FileAttachment } from "@/components/FileUpload";
import { Settings } from "@/components/Settings";
import { useSessions } from "@/hooks/useSessions";
import { useSettings } from "@/hooks/useSettings";
import { InstallBanner } from "@/components/InstallBanner";
import { NewSessionModal } from "@/components/NewSessionModal";
import { ConnectionStatus as ConnectionStatusType } from "@/hooks/useWebSocket";

export default function Home() {
  const settings = useSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [modalDismissed, setModalDismissed] = useState(false);

  // Track connection status per session for display
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, ConnectionStatusType>>({});

  // Refs to all terminal panes
  const terminalPaneRefs = useRef<Record<string, TerminalPaneHandle | null>>({});

  // Session management
  const {
    sessions,
    currentSession,
    createSession,
    selectSession,
    removeSession,
  } = useSessions();

  // Get current session's connection status
  const currentStatus = currentSession
    ? connectionStatuses[currentSession.id] ?? "disconnected"
    : "disconnected";

  // Handle connection status change from a terminal pane
  const handleStatusChange = useCallback((sessionId: string) => {
    return (status: ConnectionStatusType) => {
      setConnectionStatuses(prev => ({
        ...prev,
        [sessionId]: status,
      }));
    };
  }, []);

  // Cleanup refs and statuses for removed sessions
  useEffect(() => {
    const sessionIds = new Set(sessions.map(s => s.id));

    // Clean up refs for removed sessions
    Object.keys(terminalPaneRefs.current).forEach(id => {
      if (!sessionIds.has(id)) {
        delete terminalPaneRefs.current[id];
      }
    });

    // Clean up statuses for removed sessions
    setConnectionStatuses(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(id => {
        if (!sessionIds.has(id)) {
          delete next[id];
        }
      });
      return next;
    });
  }, [sessions]);

  // Show project selector if no sessions exist
  useEffect(() => {
    const isConfigured = settings.isLoaded && settings.serverUrl && settings.apiKey;

    if (sessions.length === 0 && isConfigured && !showNewSessionModal && !modalDismissed) {
      console.log("No sessions found, showing project selector");
      setShowNewSessionModal(true);
    }
  }, [sessions.length, settings.isLoaded, settings.serverUrl, settings.apiKey, showNewSessionModal, modalDismissed]);

  // Handle voice transcription - route to current terminal
  const handleTranscription = useCallback((text: string) => {
    if (!currentSession) return;
    const pane = terminalPaneRefs.current[currentSession.id];
    pane?.sendTranscription(text);
  }, [currentSession]);

  // Handle file uploads - route to current terminal
  const handleFileUpload = useCallback(async (attachments: FileAttachment[]) => {
    if (!currentSession) return;
    const pane = terminalPaneRefs.current[currentSession.id];
    await pane?.uploadFiles(attachments);
  }, [currentSession]);

  // Handle keyboard input - route to current terminal
  const handleKeyPress = useCallback((data: string) => {
    if (!currentSession) return;
    const pane = terminalPaneRefs.current[currentSession.id];
    pane?.sendInput(data);
  }, [currentSession]);

  // Handle new session
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
      setModalDismissed(false);
    },
    [createSession]
  );

  // Focus current terminal when tab changes
  useEffect(() => {
    if (currentSession) {
      const pane = terminalPaneRefs.current[currentSession.id];
      setTimeout(() => pane?.focus(), 100);
    }
  }, [currentSession]);

  // Show settings if not configured
  const needsConfig = !settings.serverUrl || !settings.apiKey;
  const isCurrentConnected = currentStatus === "connected";

  // Show loading state until settings are loaded
  if (!settings.isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-bg-primary">
      {/* Header */}
      <header className="flex min-h-12 items-center justify-between border-b border-border px-4 pt-[env(safe-area-inset-top)]">
        <h1 className="text-lg font-semibold text-text-primary">
          pushToCode <span className="text-xs text-text-secondary font-normal">{process.env.NEXT_PUBLIC_VERSION}</span>
        </h1>
        <div className="flex items-center gap-4">
          <ConnectionStatus status={currentStatus} />
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
          ) : sessions.length > 0 ? (
            <div className="flex-1 min-h-0 relative">
              {/* Render all session terminals, show only the current one */}
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="absolute inset-0"
                  style={{
                    visibility: session.id === currentSession?.id ? "visible" : "hidden",
                    zIndex: session.id === currentSession?.id ? 1 : 0,
                  }}
                >
                  <TerminalPane
                    ref={(handle) => {
                      terminalPaneRefs.current[session.id] = handle;
                    }}
                    sessionId={session.id}
                    repoPath={session.repoPath}
                    serverUrl={settings.serverUrl}
                    apiKey={settings.apiKey}
                    isActive={session.id === currentSession?.id}
                    onStatusChange={handleStatusChange(session.id)}
                    fontSize={settings.fontSize}
                    fontFamily={settings.fontFamily}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-text-secondary">No active session</p>
            </div>
          )}

          {/* Toolbar with action buttons */}
          <InputBar
            onKeyPress={handleKeyPress}
            onTranscription={handleTranscription}
            onFileUpload={handleFileUpload}
            disabled={!isCurrentConnected || !currentSession}
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
        onClose={() => {
          setShowNewSessionModal(false);
          setModalDismissed(true);
        }}
        onConfirm={handleCreateSessionWithRepo}
        serverUrl={settings.serverUrl}
        apiKey={settings.apiKey}
      />

      {/* PWA Install Banner */}
      <InstallBanner />
    </div>
  );
}
