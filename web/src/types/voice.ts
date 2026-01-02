/**
 * Voice mode WebSocket message types
 * Protocol for voice-first interaction with Claude
 */

// ============================================
// Voice Option Type
// ============================================

export interface VoiceOption {
  id: string;
  label: string;
  action: string;
}

// ============================================
// Client -> Server Messages
// ============================================

export type VoiceClientMessageType =
  | "voice_text"
  | "voice_select_option"
  | "ping"
  | "pong";

export interface VoiceTextMessage {
  type: "voice_text";
  text: string;
  sessionId: string;
  repoPath?: string;
}

export interface VoiceSelectOptionMessage {
  type: "voice_select_option";
  optionId: string;
  sessionId: string;
  repoPath?: string;
}

export interface VoicePingMessage {
  type: "ping";
}

export interface VoicePongMessage {
  type: "pong";
}

export type VoiceClientMessage =
  | VoiceTextMessage
  | VoiceSelectOptionMessage
  | VoicePingMessage
  | VoicePongMessage;

// ============================================
// Server -> Client Messages
// ============================================

export type VoiceServerMessageType =
  | "voice_response"
  | "voice_audio"
  | "voice_error"
  | "ping"
  | "pong";

export interface VoiceResponseMessage {
  type: "voice_response";
  text: string;
  options?: VoiceOption[];
}

export interface VoiceAudioMessage {
  type: "voice_audio";
  audio: string; // base64 encoded audio
  isFinal: boolean;
}

export interface VoiceErrorMessage {
  type: "voice_error";
  code: string;
  message: string;
}

export interface VoiceServerPingMessage {
  type: "ping";
}

export interface VoiceServerPongMessage {
  type: "pong";
}

export type VoiceServerMessage =
  | VoiceResponseMessage
  | VoiceAudioMessage
  | VoiceErrorMessage
  | VoiceServerPingMessage
  | VoiceServerPongMessage;

// ============================================
// Type Guards
// ============================================

export function isVoiceServerMessage(data: unknown): data is VoiceServerMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    typeof (data as { type: unknown }).type === "string"
  );
}

export function isVoiceResponseMessage(msg: VoiceServerMessage): msg is VoiceResponseMessage {
  return msg.type === "voice_response";
}

export function isVoiceAudioMessage(msg: VoiceServerMessage): msg is VoiceAudioMessage {
  return msg.type === "voice_audio";
}

export function isVoiceErrorMessage(msg: VoiceServerMessage): msg is VoiceErrorMessage {
  return msg.type === "voice_error";
}
