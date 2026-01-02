/**
 * Voice module interfaces for WebSocket communication
 */

// Voice option for action cards
export interface VoiceOption {
  id: string;
  label: string;
  action: string;
}

// Client -> Server Messages
export interface VoiceTextMessage {
  type: 'voice_text';
  text: string;
  sessionId: string;
  repoPath?: string;
}

export interface VoiceSelectOptionMessage {
  type: 'voice_select_option';
  optionId: string;
  sessionId: string;
  repoPath?: string;
}

export interface VoicePingMessage {
  type: 'ping';
}

export interface VoicePongMessage {
  type: 'pong';
}

export type VoiceClientMessage =
  | VoiceTextMessage
  | VoiceSelectOptionMessage
  | VoicePingMessage
  | VoicePongMessage;

// Server -> Client Messages
export interface VoiceResponseMessage {
  type: 'voice_response';
  text: string;
  options?: VoiceOption[];
  sessionId: string;
}

export interface VoiceAudioMessage {
  type: 'voice_audio';
  audio: string; // base64 encoded audio data
  isFinal: boolean;
}

export interface VoiceErrorMessage {
  type: 'error';
  sessionId: string;
  code: string;
  message: string;
}

export interface VoiceStatusMessage {
  type: 'status';
  sessionId: string;
  status: 'idle' | 'processing' | 'speaking';
}

export interface VoicePongServerMessage {
  type: 'pong';
  timestamp: number;
}

export type VoiceServerMessage =
  | VoiceResponseMessage
  | VoiceAudioMessage
  | VoiceErrorMessage
  | VoiceStatusMessage
  | VoicePongServerMessage;

// Session data for tracking voice sessions
export interface VoiceSessionData {
  sessionId: string;
  projectPath: string;
  createdAt: Date;
  lastActivityAt: Date;
}
