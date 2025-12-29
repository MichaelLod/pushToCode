/**
 * useWebSocket hook - Manages WebSocket connection lifecycle with reconnect
 */

import { useEffect, useRef, useCallback, useState } from "react";
import {
  WebSocketClient,
  WebSocketClientOptions,
  ConnectionStatus,
  getWebSocketClient,
  resetWebSocketClient,
} from "@/lib/websocket";
import { ClientMessage, ServerMessage } from "@/types/messages";

export interface UseWebSocketOptions {
  url: string;
  apiKey?: string;
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
  client: WebSocketClient | null;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const { url, apiKey, autoConnect = true } = options;

  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const clientRef = useRef<WebSocketClient | null>(null);
  const optionsRef = useRef(options);

  // Keep options ref updated
  // eslint-disable-next-line react-hooks/refs -- Keep ref in sync with latest options
  optionsRef.current = options;

  // Initialize client
  useEffect(() => {
    const clientOptions: WebSocketClientOptions = {
      url,
      apiKey,
      reconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: 10,
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

    // Get or create singleton client
    try {
      clientRef.current = getWebSocketClient(clientOptions);
    } catch {
      // Client already exists, update API key if needed
      clientRef.current = getWebSocketClient();
      if (apiKey) {
        clientRef.current.setApiKey(apiKey);
      }
    }

    // Auto-connect if enabled
    if (autoConnect && clientRef.current) {
      clientRef.current.connect();
    }

    // Update status from client
    if (clientRef.current) {
      setStatus(clientRef.current.getStatus());
    }

    return () => {
      // Cleanup on unmount - don't reset singleton, just disconnect
      // resetWebSocketClient() would prevent other components from using it
    };
  }, [url, apiKey, autoConnect]);

  const connect = useCallback(() => {
    clientRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  const send = useCallback((message: ClientMessage): boolean => {
    return clientRef.current?.send(message) ?? false;
  }, []);

  return {
    status,
    isConnected: status === "connected",
    connect,
    disconnect,
    send,
    client: clientRef.current, // eslint-disable-line react-hooks/refs -- Expose instance
  };
}

/**
 * Hook to reset the WebSocket client completely
 * Useful for logout or app reset scenarios
 */
export function useWebSocketReset(): () => void {
  return useCallback(() => {
    resetWebSocketClient();
  }, []);
}

export type { ConnectionStatus };
