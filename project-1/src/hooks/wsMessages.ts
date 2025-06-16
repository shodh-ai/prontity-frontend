// Base message type with a discriminator field
export interface BaseMessage {
  type: string;
}

// Client -> Server: Sending editor content updates
export interface TextUpdateMessage extends BaseMessage {
  type: 'text_update';
  content: string; // HTML content of the editor
  timestamp?: number; // Optional timestamp
}

// Server -> Client: Receiving AI suggestions/highlights
export interface AISuggestionMessage extends BaseMessage {
  type: 'ai_suggestion';
  suggestions: {
    id: string;
    start: number; // Position in text
    end: number;   // Position in text
    type: 'grammar' | 'coherence' | 'suggestion' | string;
    message: string;
  }[];
}

// Server -> Client: Connection acknowledgment
export interface ConnectionAckMessage extends BaseMessage {
  type: 'connection_ack';
  sessionId: string;
  message: string;
}

// Server -> Client: Error message
export interface ErrorMessage extends BaseMessage {
  type: 'error';
  code: string;
  message: string;
}

// Union type of all server messages
export type ServerMessage = 
  | AISuggestionMessage 
  | ConnectionAckMessage 
  | ErrorMessage;

// Union type of all client messages
export type ClientMessage = 
  | TextUpdateMessage;

// Type guard functions to narrow message types
export function isTextUpdateMessage(message: BaseMessage): message is TextUpdateMessage {
  return message.type === 'text_update';
}

export function isAISuggestionMessage(message: BaseMessage): message is AISuggestionMessage {
  return message.type === 'ai_suggestion';
}

export function isConnectionAckMessage(message: BaseMessage): message is ConnectionAckMessage {
  return message.type === 'connection_ack';
}

export function isErrorMessage(message: BaseMessage): message is ErrorMessage {
  return message.type === 'error';
}
