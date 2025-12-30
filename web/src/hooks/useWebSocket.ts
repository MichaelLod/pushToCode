/**
 * useWebSocket hook - Manages WebSocket connection lifecycle with reconnect
 * Each instance creates its own WebSocket client (one per terminal session)
 */

import { useEffect, useRef, useCallback, useState } from "react";
import {
  WebSocketClient,
  WebSocketClientOptions,
  ConnectionStatus,
  createWebSocketClient,
} from "@/lib/websocket";
import { ClientMessage, ServerMessage } from "@/types/messages";

export interface UseWebSocketOptions {
  url: string;
  apiKey?: string;
  sessionId: string; // Required - each terminal has its own connection
  autoConnect?: boolean;
  onMessage?: (message: ServerMessage) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  onError?: (error: Event | Error) => void;
}

export interface UseWebSocketReturn {
  status: ConnectionStatus;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  send: (message: ClientMessage) => boolean;
  checkConnection: () => void;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const { url, apiKey, sessionId, autoConnect = true } = options;

  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const clientRef = useRef<WebSocketClient | null>(null);
  const optionsRef = useRef(options);

  // Keep options ref updated
  // eslint-disable-next-line react-hooks/refs -- Keep ref in sync with latest options
  optionsRef.current = options;

  // Initialize client - create new client for this session
  useEffect(() => {
    // Don't create client without required params
    if (!url || !sessionId) {
      return;
    }

    // Clean up existing client if any
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }

    const clientOptions: WebSocketClientOptions = {
      url,
      apiKey,
      reconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: Infinity,
      pingInterval: 30000,
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
        optionsRef.current.onStatusChange?.(newStatus);
      },
      onMessage: (message) => {
        optionsRef.current.onMessage?.(message);
      },
      onError: (error) => {
        optionsRef.current.onError?.(error);
      },
    };

    // Create new client for this terminal session
    clientRef.current = createWebSocketClient(clientOptions);

    // Auto-connect if enabled
    if (autoConnect) {
      clientRef.current.connect();
    }

    return () => {
      // Cleanup on unmount - disconnect this session's WebSocket
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, [url, apiKey, sessionId, autoConnect]);

  const connect = useCallback(() => {
    clientRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  const send = useCallback((message: ClientMessage): boolean => {
    return clientRef.current?.send(message) ?? false;
  }, []);

  const checkConnection = useCallback(() => {
    clientRef.current?.checkConnection();
  }, []);

  return {
    status,
    isConnected: status === "connected",
    connect,
    disconnect,
    send,
    checkConnection,
  };
}

export type { ConnectionStatus };
