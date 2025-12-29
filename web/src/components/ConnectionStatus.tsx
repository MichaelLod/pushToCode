"use client";

/**
 * ConnectionStatus component - Shows WebSocket connection state with accessible indicators
 */

import { useMemo } from "react";
import { ConnectionStatus as ConnectionStatusType } from "@/lib/websocket";

export interface ConnectionStatusProps {
  status: ConnectionStatusType;
  className?: string;
  showLabel?: boolean;
}

interface StatusConfig {
  color: string;
  label: string;
  ariaLabel: string;
}

function getStatusConfig(status: ConnectionStatusType): StatusConfig {
  switch (status) {
    case "connected":
      return {
        color: "#9ece6a", // green
        label: "Connected",
        ariaLabel: "Connection status: Connected to server",
      };
    case "connecting":
      return {
        color: "#e0af68", // yellow
        label: "Connecting...",
        ariaLabel: "Connection status: Connecting to server",
      };
    case "disconnected":
      return {
        color: "#f7768e", // red
        label: "Disconnected",
        ariaLabel: "Connection status: Disconnected from server",
      };
    case "error":
      return {
        color: "#f7768e", // red
        label: "Connection Error",
        ariaLabel: "Connection status: Error connecting to server",
      };
    default:
      return {
        color: "#a9b1d6", // gray
        label: "Unknown",
        ariaLabel: "Connection status: Unknown",
      };
  }
}

export function ConnectionStatus({
  status,
  className = "",
  showLabel = false,
}: ConnectionStatusProps) {
  const config = useMemo(() => getStatusConfig(status), [status]);

  const isPulsing = status === "connecting";

  return (
    <div
      className={`connection-status ${className}`}
      role="status"
      aria-live="polite"
      aria-label={config.ariaLabel}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      {/* Status dot */}
      <span
        style={{
          position: "relative",
          display: "inline-block",
          width: "10px",
          height: "10px",
        }}
        aria-hidden="true"
      >
        {/* Pulse animation for connecting state */}
        {isPulsing && (
          <span
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              backgroundColor: config.color,
              opacity: 0.4,
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        )}
        {/* Main dot */}
        <span
          style={{
            position: "relative",
            display: "block",
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            backgroundColor: config.color,
            boxShadow: `0 0 4px ${config.color}`,
          }}
        />
      </span>

      {/* Label (optional) */}
      {showLabel && (
        <span
          style={{
            fontSize: "12px",
            color: "#a9b1d6",
            fontFamily: "inherit",
          }}
        >
          {config.label}
        </span>
      )}

      {/* Keyframe animation styles */}
      <style jsx>{`
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 0.4;
          }
          50% {
            transform: scale(2);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Compact connection status for use in headers/toolbars
 */
export function ConnectionStatusCompact({
  status,
  className = "",
}: Omit<ConnectionStatusProps, "showLabel">) {
  const config = useMemo(() => getStatusConfig(status), [status]);

  return (
    <span
      className={`connection-status-compact ${className}`}
      role="status"
      aria-live="polite"
      aria-label={config.ariaLabel}
      title={config.label}
      style={{
        display: "inline-block",
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        backgroundColor: config.color,
        boxShadow: `0 0 4px ${config.color}`,
      }}
    />
  );
}

export default ConnectionStatus;
