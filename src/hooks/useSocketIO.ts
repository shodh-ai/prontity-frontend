import { useEffect, useState, useCallback } from 'react';
import { useSocketIOContext } from '@/contexts/SocketIOContext';
import { Socket } from 'socket.io-client';

// Define the types for messages you expect to receive
// Example: Adjust based on your actual message structure
interface AISuggestionMessage {
  type: 'ai_suggestion';
  suggestion: string;
}

interface ConnectionAckMessage {
  type: 'connection_ack';
  clientId: string;
}

interface ErrorMessage {
  type: 'error';
  message: string;
}

type ReceivedMessage = AISuggestionMessage | ConnectionAckMessage | ErrorMessage; // Add other message types as needed

// Type guards
function isAISuggestionMessage(msg: any): msg is AISuggestionMessage {
  return msg && msg.type === 'ai_suggestion' && typeof msg.suggestion === 'string';
}

function isConnectionAckMessage(msg: any): msg is ConnectionAckMessage {
  return msg && msg.type === 'connection_ack' && typeof msg.clientId === 'string';
}

function isErrorMessage(msg: any): msg is ErrorMessage {
  return msg && msg.type === 'error' && typeof msg.message === 'string';
}

// Hook interface
interface UseSocketIOResult {
  socket: Socket | null;
  isConnected: boolean;
  lastMessage: ReceivedMessage | null;
  sendMessage: (message: object) => void;
  aiSuggestion: string | null;
  clientId: string | null;
  error: string | null;
}

export function useSocketIO(): UseSocketIOResult {
  const { socket, isConnected } = useSocketIOContext();
  const [lastMessage, setLastMessage] = useState<ReceivedMessage | null>(null);
  const [aiSuggestion, setAISuggestion] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle incoming messages
  const handleMessage = useCallback((message: any) => {
    console.log('Received message:', message);
    setLastMessage(message);

    if (isAISuggestionMessage(message)) {
      setAISuggestion(message.suggestion);
    } else if (isConnectionAckMessage(message)) {
      setClientId(message.clientId);
    } else if (isErrorMessage(message)) {
      setError(message.message);
    }
  }, []);

  // Set up listeners when the socket changes
  useEffect(() => {
    if (!socket) return;

    // Listen for messages
    socket.on('message', handleMessage);

    // Additional event listeners can be added here
    socket.on('ai_suggestion', (data) => {
      console.log('Received ai_suggestion event:', data);
      try {
        // If data is a string (JSON), parse it
        const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
        console.log('Parsed AI suggestion data:', parsedData);
        
        // Extract the suggestions array from the response
        if (parsedData && parsedData.type === 'ai_suggestion' && Array.isArray(parsedData.suggestions)) {
          handleMessage({ type: 'ai_suggestion', suggestion: JSON.stringify(parsedData.suggestions) });
        } else {
          // Handle direct suggestion format
          handleMessage({ type: 'ai_suggestion', suggestion: JSON.stringify(parsedData) });
        }
      } catch (error) {
        console.error('Error processing AI suggestion:', error, data);
      }
    });

    return () => {
      // Clean up listeners
      socket.off('message', handleMessage);
      socket.off('ai_suggestion');
    };
  }, [socket, handleMessage]);

  // Function to send messages
  const sendMessage = useCallback(
    (message: object) => {
      if (socket && isConnected) {
        console.log('Sending message:', message);
        socket.emit('message', message);
        return true;
      } else {
        console.warn('Cannot send message: socket not connected');
        return false;
      }
    },
    [socket, isConnected]
  );

  return {
    socket,
    isConnected,
    lastMessage,
    sendMessage,
    aiSuggestion,
    clientId,
    error,
  };
}
