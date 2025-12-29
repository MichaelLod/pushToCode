"use client";

/**
 * SessionTabs component - Tab bar for managing multiple terminal sessions
 */

import { useCallback } from "react";
import { SessionWithTerminal } from "@/hooks/useSessions";
import { SessionStatus } from "@/types/session";

export interface SessionTabsProps {
  sessions: SessionWithTerminal[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onAddSession: () => void;
  onCloseSession: (sessionId: string) => void;
  className?: string;
}

function getStatusColor(status: SessionStatus): string {
  switch (status) {
    case "running":
      return "#9ece6a"; // green
    case "error":
      return "#f7768e"; // red
    case "disconnected":
      return "#f7768e"; // red
    case "idle":
      return "#7aa2f7"; // blue
    case "completed":
      return "#a9b1d6"; // gray
    default:
      return "#a9b1d6";
  }
}

function getStatusLabel(status: SessionStatus): string {
  switch (status) {
    case "running":
      return "Running";
    case "error":
      return "Error";
    case "disconnected":
      return "Disconnected";
    case "idle":
      return "Idle";
    case "completed":
      return "Completed";
    default:
      return status;
  }
}

export function SessionTabs({
  sessions,
  currentSessionId,
  onSelectSession,
  onAddSession,
  onCloseSession,
  className = "",
}: SessionTabsProps) {
  const handleCloseClick = useCallback(
    (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      onCloseSession(sessionId);
    },
    [onCloseSession]
  );

  return (
    <div
      className={`session-tabs ${className}`}
      style={{
        display: "flex",
        alignItems: "center",
        backgroundColor: "#15161e",
        borderBottom: "1px solid #1a1b26",
        minHeight: "40px",
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        // Hide scrollbar but allow scrolling
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
      role="tablist"
      aria-label="Terminal sessions"
    >
      {/* Session tabs */}
      {sessions.map((session) => (
        <div
          key={session.id}
          role="tab"
          tabIndex={0}
          aria-selected={session.id === currentSessionId}
          aria-controls={`terminal-${session.id}`}
          onClick={() => onSelectSession(session.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectSession(session.id);
            }
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 12px",
            backgroundColor:
              session.id === currentSessionId ? "#1a1b26" : "transparent",
            border: "none",
            borderBottom:
              session.id === currentSessionId
                ? "2px solid #7aa2f7"
                : "2px solid transparent",
            color: session.id === currentSessionId ? "#c0caf5" : "#a9b1d6",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "13px",
            whiteSpace: "nowrap",
            transition: "background-color 0.15s, color 0.15s",
            // Touch-friendly minimum size
            minWidth: "44px",
            minHeight: "40px",
          }}
        >
          {/* Status indicator */}
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: getStatusColor(session.status),
              flexShrink: 0,
            }}
            title={getStatusLabel(session.status)}
            aria-hidden="true"
          />

          {/* Session name */}
          <span style={{ maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis" }}>
            {session.name}
          </span>

          {/* Close button */}
          <button
            onClick={(e) => handleCloseClick(e, session.id)}
            aria-label={`Close ${session.name}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "20px",
              height: "20px",
              padding: 0,
              border: "none",
              borderRadius: "4px",
              backgroundColor: "transparent",
              color: "#a9b1d6",
              cursor: "pointer",
              fontSize: "14px",
              lineHeight: 1,
              transition: "background-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#33467c";
              e.currentTarget.style.color = "#c0caf5";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#a9b1d6";
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <line x1="2" y1="2" x2="10" y2="10" />
              <line x1="10" y1="2" x2="2" y2="10" />
            </svg>
          </button>
        </div>
      ))}

      {/* Add session button */}
      <button
        onClick={onAddSession}
        aria-label="Add new terminal session"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "36px",
          height: "36px",
          marginLeft: "4px",
          padding: 0,
          border: "none",
          borderRadius: "4px",
          backgroundColor: "transparent",
          color: "#a9b1d6",
          cursor: "pointer",
          fontSize: "18px",
          lineHeight: 1,
          transition: "background-color 0.15s, color 0.15s",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#1a1b26";
          e.currentTarget.style.color = "#c0caf5";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "#a9b1d6";
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <line x1="8" y1="2" x2="8" y2="14" />
          <line x1="2" y1="8" x2="14" y2="8" />
        </svg>
      </button>
    </div>
  );
}

export default SessionTabs;
