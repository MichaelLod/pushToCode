/**
 * WebSocket client with automatic reconnection
 */

import {
  ClientMessage,
  ServerMessage,
  isServerMessage,
  PingMessage,
  PongMessage,
} from "@/types/messages";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface WebSocketClientOptions {
  url: string;
  apiKey?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
  onStatusChange?: (status: ConnectionStatus) => void;
  onMessage?: (message: ServerMessage) => void;
  onError?: (error: Event | Error) => void;
}

const DEFAULT_OPTIONS: Required<Omit<WebSocketClientOptions, "url" | "apiKey" | "onStatusChange" | "onMessage" | "onError">> = {
  reconnect: true,
  reconnectInterval: 1000,
  maxReconnectAttempts: Infinity, // Never give up reconnecting
  pingInterval: 30000,
};

// Maximum delay between reconnect attempts (30 seconds)
const MAX_RECONNECT_DELAY = 30000;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private options: WebSocketClientOptions & typeof DEFAULT_OPTIONS;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private status: ConnectionStatus = "disconnected";
  private messageQueue: ClientMessage[] = [];
  private isIntentionallyClosed = false;

  constructor(options: WebSocketClientOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    // Don't reconnect if already open or connecting
    if (this.ws?.readyState === WebSocket.OPEN ||
        this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.isIntentionallyClosed = false;
    this.setStatus("connecting");

    try {
      // Build URL with API key as query param (browser WebSocket can't send headers)
      let wsUrl = this.options.url;
      if (this.options.apiKey) {
        const separator = wsUrl.includes("?") ? "&" : "?";
        wsUrl = `${wsUrl}${separator}apiKey=${encodeURIComponent(this.options.apiKey)}`;
      }
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      this.setStatus("error");
      this.options.onError?.(error as Error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;
    this.cleanup();
    this.setStatus("disconnected");
  }

  /**
   * Send a message to the server
   */
  send(message: ClientMessage): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }

    // Queue message for when connection is established
    this.messageQueue.push(message);
    return false;
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.status === "connected";
  }

  /**
   * Check connection health and reconnect if needed
   * Called when app resumes from background
   */
  checkConnection(): void {
    // If we think we're connected but socket is actually closed, reconnect
    if (this.status === "connected" && this.ws?.readyState !== WebSocket.OPEN) {
      console.log("Connection stale, reconnecting...");
      this.cleanup();
      this.setStatus("disconnected");
      this.connect();
    } else if (this.status === "disconnected" && !this.isIntentionallyClosed) {
      console.log("Was disconnected, reconnecting...");
      this.connect();
    }
  }

  /**
   * Update API key (for authentication)
   */
  setApiKey(apiKey: string): void {
    this.options.apiKey = apiKey;
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus("connected");

      // Note: API key is already sent in URL query params (line 62-64)
      // and validated by the gateway on connection. The "login" message
      // is only for triggering OAuth flow when needed, not for API key auth.

      // Send queued messages
      this.flushMessageQueue();

      // Start ping interval
      this.startPingInterval();
    };

    this.ws.onclose = () => {
      this.cleanup();

      if (!this.isIntentionallyClosed) {
        this.setStatus("disconnected");
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      this.options.onError?.(error);
      this.setStatus("error");
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (!isServerMessage(data)) {
          console.warn("Received invalid message:", data);
          return;
        }

        // Handle ping/pong internally
        if (data.type === "ping") {
          this.send({ type: "pong" } as PongMessage);
          return;
        }

        if (data.type === "pong") {
          // Pong received, connection is alive
          return;
        }

        this.options.onMessage?.(data);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.options.onStatusChange?.(status);
    }
  }

  private scheduleReconnect(): void {
    if (!this.options.reconnect || this.isIntentionallyClosed) {
      return;
    }

    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      this.setStatus("error");
      return;
    }

    // Exponential backoff with a max delay cap
    const baseDelay = this.options.reconnectInterval * Math.pow(2, Math.min(this.reconnectAttempts, 5));
    const delay = Math.min(baseDelay, MAX_RECONNECT_DELAY);
    this.reconnectAttempts++;

    const attemptsDisplay = this.options.maxReconnectAttempts === Infinity
      ? `attempt ${this.reconnectAttempts}`
      : `attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts}`;
    console.log(`Reconnecting in ${delay}ms (${attemptsDisplay})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startPingInterval(): void {
    this.stopPingInterval();

    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: "ping" } as PingMessage);
      }
    }, this.options.pingInterval);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  private cleanup(): void {
    this.stopPingInterval();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;

      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }

      this.ws = null;
    }
  }
}

/**
 * Create a new WebSocket client instance
 * Each terminal session should have its own client
 */
export function createWebSocketClient(options: WebSocketClientOptions): WebSocketClient {
  return new WebSocketClient(options);
}
