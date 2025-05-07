import { useState, useEffect, useRef, useCallback } from 'react';

// Define possible connection statuses
type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'error';

// Define the hook's props
interface UseWebSocketProps<TReceive = any> {
  url: string | null; // Allow null URL to disable connection initially
  onMessage: (data: TReceive) => void; // Callback for received messages
  onError?: (event: Event) => void; // Optional error handler
  onOpen?: (event: Event) => void; // Optional open handler
  onClose?: (event: CloseEvent) => void; // Optional close handler
  reconnect?: boolean; // Enable/disable auto-reconnection
  reconnectInterval?: number; // Delay between reconnection attempts (ms)
  debug?: boolean; // Enable console logging
}

// Define the hook's return value
interface UseWebSocketReturn<TSend = any> {
  sendMessage: (data: TSend) => boolean;
  connectionStatus: ConnectionStatus;
}

export function useWebSocket<TReceive = any, TSend = any>({
  url,
  onMessage,
  onError,
  onOpen,
  onClose,
  reconnect = true, // Default to true
  reconnectInterval = 3000, // Default to 3 seconds
  debug = false,
}: UseWebSocketProps<TReceive>): UseWebSocketReturn<TSend> {
  // Keep track of connection state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('closed');
  
  // Store WebSocket instance reference
  const ws = useRef<WebSocket | null>(null);
  
  // Reconnection management
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttemptsRef = useRef(5);
  
  // Track component mount state to prevent updates after unmount
  const isMountedRef = useRef(true);
  
  // Logging helper that respects debug flag
  const log = useCallback((...args: any[]) => {
    if (debug) {
      console.log('[useWebSocket]', ...args);
    }
  }, [debug]);

  // Store stable references to callbacks to avoid unnecessary reconnections
  const stableOnMessage = useCallback(onMessage, [onMessage]);
  const stableOnError = useCallback(onError || (() => {}), [onError]);
  const stableOnOpen = useCallback(onOpen || (() => {}), [onOpen]);
  const stableOnClose = useCallback(onClose || (() => {}), [onClose]);

  // Function to establish connection
  const connect = useCallback(() => {
    // Don't connect if no URL is provided
    if (!url) {
      log('No URL provided, skipping connection.');
      setConnectionStatus('closed');
      return;
    }
    
    // Check if we already have an active connection
    if (ws.current) {
      if (ws.current.readyState === WebSocket.OPEN) {
        log('Connection already open.');
        return; // Already connected
      } else if (ws.current.readyState === WebSocket.CONNECTING) {
        log('Connection already in progress.');
        return; // Already trying to connect
      }
      
      // Clean up any socket in CLOSING or CLOSED state
      try {
        ws.current.close(1000, 'Replacing connection');
      } catch (e) {
        // Ignore errors when closing already closed connections
      }
    }
    
    // Start new connection
    log(`Connecting to ${url}...`);
    setConnectionStatus('connecting');
    
    try {
      const socket = new WebSocket(url);
      ws.current = socket;
      
      // Setup event handlers
      socket.onopen = (event) => {
        if (!isMountedRef.current) return;
        
        log('Connection opened');
        setConnectionStatus('open');
        reconnectAttemptsRef.current = 0; // Reset reconnect counter on successful connection
        stableOnOpen(event);
      };
      
      socket.onclose = (event) => {
        if (!isMountedRef.current) return;
        
        log(`Connection closed: Code=${event.code}, Reason=${event.reason}, Clean=${event.wasClean}`);
        setConnectionStatus('closed');
        ws.current = null; // Clear reference when closed
        stableOnClose(event);
        
        // Attempt reconnection if enabled and not a normal closure
        if (reconnect && event.code !== 1000 && isMountedRef.current) {
          if (reconnectAttemptsRef.current < maxReconnectAttemptsRef.current) {
            reconnectAttemptsRef.current++;
            const backoffDelay = reconnectInterval * Math.pow(1.5, reconnectAttemptsRef.current - 1);
            
            log(`Attempting reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttemptsRef.current}) in ${backoffDelay}ms`);
            
            // Clear any existing timeout
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }
            
            // Schedule reconnection
            reconnectTimeoutRef.current = setTimeout(connect, backoffDelay);
          } else {
            log(`Maximum reconnection attempts (${maxReconnectAttemptsRef.current}) reached`);
          }
        }
      };
      
      socket.onerror = (event) => {
        if (!isMountedRef.current) return;
        
        log('Connection error:', event);
        setConnectionStatus('error');
        stableOnError(event);
        // Note: WebSocket will usually fire onclose after onerror
      };
      
      socket.onmessage = (event) => {
        if (!isMountedRef.current) return;
        
        try {
          const data = JSON.parse(event.data) as TReceive;
          log('Message received:', data);
          stableOnMessage(data);
        } catch (error) {
          log(`Failed to parse message: ${error}`);
        }
      };
    } catch (error) {
      log(`Error creating WebSocket: ${error}`);
      setConnectionStatus('error');
      
      // Schedule reconnect on connection error
      if (reconnect && isMountedRef.current) {
        const backoffDelay = reconnectInterval;
        log(`Scheduling reconnection in ${backoffDelay}ms`);
        
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        reconnectTimeoutRef.current = setTimeout(connect, backoffDelay);
      }
    }
  }, [url, reconnect, reconnectInterval, log, stableOnMessage, stableOnError, stableOnOpen, stableOnClose]);

  // Initialize connection and handle cleanup
  useEffect(() => {
    // Set mounted flag
    isMountedRef.current = true;
    reconnectAttemptsRef.current = 0;
    
    if (url) {
      connect(); // Initial connection attempt
    } else {
      // If URL becomes null, close existing connection
      if (ws.current) {
        log('URL removed, closing connection.');
        try {
          ws.current.close(1000, 'URL removed');
        } catch (e) {
          // Ignore errors
        }
        ws.current = null;
        setConnectionStatus('closed');
      }
      
      // Clear any pending reconnections
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    }
    
    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      
      // Clear any pending reconnection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
        log('Cleared reconnection timer on cleanup');
      }
      
      // Close the connection if it exists
      if (ws.current) {
        log('Closing WebSocket connection on cleanup');
        try {
          ws.current.close(1000, 'Component unmounting');
        } catch (e) {
          // Ignore errors when closing already closed connections
        }
        ws.current = null;
      }
    };
  }, [url, connect, log]);

  // Function to send messages
  const sendMessage = useCallback((message: TSend): boolean => {
    // If socket isn't open, reconnect if appropriate
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      if (ws.current?.readyState !== WebSocket.CONNECTING) {
        log('WebSocket not open or connecting, cannot send message');
        
        // Attempt to reconnect if allowed
        if (reconnect && connectionStatus !== 'connecting') {
          connect();
        }
      } else {
        log('WebSocket is connecting, cannot send message yet');
      }
      return false;
    }
    
    // Send the message
    try {
      ws.current.send(JSON.stringify(message));
      log('Message sent:', message);
      return true;
    } catch (error) {
      log(`Error sending message: ${error}`);
      return false;
    }
  }, [connect, connectionStatus, log, reconnect]);

  return { sendMessage, connectionStatus };
}
