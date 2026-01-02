/**
 * useVoiceWebSocket hook - Manages WebSocket connection for voice mode
 * Connects to /voice endpoint with same auth pattern as useWebSocket
 */

import { useEffect, useRef, useCallback, useState } from "react";
import {
  VoiceClientMessage,
  VoiceServerMessage,
  isVoiceServerMessage,
  VoicePongMessage,
} from "@/types/voice";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface UseVoiceWebSocketOptions {
  url: string;
  apiKey?: string;
  sessionId: string;
  repoPath?: string;
  autoConnect?: boolean;
  onMessage?: (message: VoiceServerMessage) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  onError?: (error: Event | Error) => void;
}

export interface UseVoiceWebSocketReturn {
  status: ConnectionStatus;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  send: (message: VoiceClientMessage) => boolean;
  sendText: (text: string) => boolean;
  selectOption: (optionId: string) => boolean;
}

const DEFAULT_OPTIONS = {
  reconnect: true,
  reconnectInterval: 1000,
  maxReconnectAttempts: Infinity,
  pingInterval: 30000,
};

const MAX_RECONNECT_DELAY = 30000;

export function useVoiceWebSocket(options: UseVoiceWebSocketOptions): UseVoiceWebSocketReturn {
  const { url, apiKey, sessionId, repoPath, autoConnect = true } = options;

  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const optionsRef = useRef(options);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageQueueRef = useRef<VoiceClientMessage[]>([]);
  const isIntentionallyClosedRef = useRef(false);

  // Keep options ref updated
  optionsRef.current = options;

  const cleanup = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;

      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }

      wsRef.current = null;
    }
  }, []);

  const updateStatus = useCallback((newStatus: ConnectionStatus) => {
    setStatus(newStatus);
    optionsRef.current.onStatusChange?.(newStatus);
  }, []);

  const flushMessageQueue = useCallback(() => {
    while (messageQueueRef.current.length > 0) {
      const message = messageQueueRef.current.shift();
      if (message && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message));
      }
    }
  }, []);

  const startPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, DEFAULT_OPTIONS.pingInterval);
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!DEFAULT_OPTIONS.reconnect || isIntentionallyClosedRef.current) {
      return;
    }

    if (reconnectAttemptsRef.current >= DEFAULT_OPTIONS.maxReconnectAttempts) {
      console.error("[VoiceWS] Max reconnection attempts reached");
      updateStatus("error");
      return;
    }

    const baseDelay = DEFAULT_OPTIONS.reconnectInterval * Math.pow(2, Math.min(reconnectAttemptsRef.current, 5));
    const delay = Math.min(baseDelay, MAX_RECONNECT_DELAY);
    reconnectAttemptsRef.current++;

    console.log(`[VoiceWS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [updateStatus]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    if (!url || !sessionId) {
      return;
    }

    isIntentionallyClosedRef.current = false;
    updateStatus("connecting");

    try {
      // Build voice WebSocket URL with API key as query param
      let wsUrl = url.replace(/\/$/, "") + "/voice";
      if (apiKey) {
        const separator = wsUrl.includes("?") ? "&" : "?";
        wsUrl = `${wsUrl}${separator}apiKey=${encodeURIComponent(apiKey)}`;
      }

      console.log("[VoiceWS] Connecting to:", wsUrl);
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log("[VoiceWS] Connected");
        reconnectAttemptsRef.current = 0;
        updateStatus("connected");
        flushMessageQueue();
        startPingInterval();
      };

      wsRef.current.onclose = () => {
        console.log("[VoiceWS] Disconnected");
        cleanup();

        if (!isIntentionallyClosedRef.current) {
          updateStatus("disconnected");
          scheduleReconnect();
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("[VoiceWS] Error:", error);
        optionsRef.current.onError?.(error);
        updateStatus("error");
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (!isVoiceServerMessage(data)) {
            console.warn("[VoiceWS] Received invalid message:", data);
            return;
          }

          // Handle ping/pong internally
          if (data.type === "ping") {
            wsRef.current?.send(JSON.stringify({ type: "pong" } as VoicePongMessage));
            return;
          }

          if (data.type === "pong") {
            return;
          }

          optionsRef.current.onMessage?.(data);
        } catch (error) {
          console.error("[VoiceWS] Failed to parse message:", error);
        }
      };
    } catch (error) {
      console.error("[VoiceWS] Connection error:", error);
      updateStatus("error");
      optionsRef.current.onError?.(error as Error);
      scheduleReconnect();
    }
  }, [url, apiKey, sessionId, updateStatus, cleanup, flushMessageQueue, startPingInterval, scheduleReconnect]);

  const disconnect = useCallback(() => {
    isIntentionallyClosedRef.current = true;
    cleanup();
    updateStatus("disconnected");
  }, [cleanup, updateStatus]);

  const send = useCallback((message: VoiceClientMessage): boolean => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }

    messageQueueRef.current.push(message);
    return false;
  }, []);

  const sendText = useCallback((text: string): boolean => {
    return send({
      type: "voice_text",
      text,
      sessionId,
      repoPath,
    });
  }, [send, sessionId, repoPath]);

  const selectOption = useCallback((optionId: string): boolean => {
    return send({
      type: "voice_select_option",
      optionId,
      sessionId,
      repoPath,
    });
  }, [send, sessionId, repoPath]);

  // Connect on mount if autoConnect
  useEffect(() => {
    if (!url || !sessionId) {
      return;
    }

    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [url, sessionId, autoConnect]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status,
    isConnected: status === "connected",
    connect,
    disconnect,
    send,
    sendText,
    selectOption,
  };
}

export type { ConnectionStatus as VoiceConnectionStatus };
