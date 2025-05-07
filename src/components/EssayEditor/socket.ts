/**
 * Socket manager for real-time collaboration
 */
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Hook to manage socket.io connection for the essay editor
 * @param socketUrl Base URL for socket connection, pass null to disable
 * @param essayId ID of the essay for room management
 */
export const useSocketManager = (socketUrl: string | null, essayId: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // If no socketUrl or no essayId, don't attempt to connect
    if (!socketUrl || !essayId) {
      return;
    }

    // Create a new socket connection
    const newSocket = io(socketUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    // Set up event handlers
    newSocket.on('connect', () => {
      console.log(`Socket connected. Socket ID: ${newSocket.id}`);
      setConnected(true);
      
      // Join the essay-specific room after connecting
      newSocket.emit('join-essay', { essayId });
    });

    newSocket.on('joined-essay', (data) => {
      console.log(`Joined essay room: ${data.essayId}`);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnected(false);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected. Reason:', reason);
      setConnected(false);
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Store the socket in state
    setSocket(newSocket);
    
    // Cleanup on unmount or if socketUrl/essayId changes
    return () => {
      if (newSocket) {
        console.log('Disconnecting socket');
        newSocket.disconnect();
        setConnected(false);
      }
    };
  }, [socketUrl, essayId]);

  return { socket, connected };
};

export default useSocketManager;
