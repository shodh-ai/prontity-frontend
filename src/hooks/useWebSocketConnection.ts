/**
 * useWebSocketConnection.ts
 * A hook that provides access to the WebSocketService singleton
 */

import { useState, useEffect, useCallback } from 'react';
import WebSocketService from '../services/WebSocketService';

type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'error';

interface UseWebSocketConnectionProps {
  url: string | null;
  onMessage?: (data: any) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  debug?: boolean;
}

interface UseWebSocketConnectionReturn {
  sendMessage: (data: any) => boolean;
  status: ConnectionStatus;
}

export function useWebSocketConnection({
  url,
  onMessage,
  onStatusChange,
  debug = false,
}: UseWebSocketConnectionProps): UseWebSocketConnectionReturn {
  const [status, setStatus] = useState<ConnectionStatus>(WebSocketService.getStatus());

  // Set debug mode
  useEffect(() => {
    WebSocketService.setDebug(debug);
  }, [debug]);

  // Handle status changes
  useEffect(() => {
    const handleStatusChange = (newStatus: ConnectionStatus) => {
      setStatus(newStatus);
      if (onStatusChange) {
        onStatusChange(newStatus);
      }
    };

    WebSocketService.on('statusChange', handleStatusChange);
    
    return () => {
      WebSocketService.removeListener('statusChange', handleStatusChange);
    };
  }, [onStatusChange]);

  // Handle incoming messages
  useEffect(() => {
    if (!onMessage) return;

    const handleMessage = (data: any) => {
      onMessage(data);
    };

    WebSocketService.on('message', handleMessage);
    
    return () => {
      WebSocketService.removeListener('message', handleMessage);
    };
  }, [onMessage]);

  // Connect/disconnect based on URL
  useEffect(() => {
    if (url) {
      WebSocketService.connect(url);
    } else {
      WebSocketService.disconnect();
    }

    return () => {
      // No need to disconnect on unmount - other components might use the connection
      // WebSocketService.disconnect();
    };
  }, [url]);

  // Send message wrapper
  const sendMessage = useCallback((data: any): boolean => {
    return WebSocketService.send(data);
  }, []);

  return {
    sendMessage,
    status,
  };
}

export default useWebSocketConnection;
