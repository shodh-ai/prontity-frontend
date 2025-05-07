'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketIOContextProps {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketIOContext = createContext<SocketIOContextProps | undefined>(undefined);

interface SocketIOProviderProps {
  children: ReactNode;
}

export const SocketIOProvider: React.FC<SocketIOProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Ensure this runs only on the client side
    if (typeof window === 'undefined') {
      return;
    }

    const socketIoUrl = process.env.NEXT_PUBLIC_SOCKET_IO_URL || 'ws://localhost:8001';
    console.log(`Attempting to connect to Socket.IO server at ${socketIoUrl}`);

    // Prevent multiple connections
    if (socket) {
      console.log('Socket instance already exists, skipping connection.');
      return;
    }

    const newSocket = io(socketIoUrl, {
      transports: ['websocket'], // Explicitly use WebSocket transport
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('Socket.IO Connected:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket.IO Disconnected:', reason);
      setIsConnected(false);
      // Optional: Handle specific disconnect reasons if needed
      // if (reason === 'io server disconnect') {
      //   // the disconnection was initiated by the server, you need to reconnect manually
      //   newSocket.connect();
      // }
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket.IO Connection Error:', error);
      setIsConnected(false);
      // Attempt to reconnect or show an error message
    });

    setSocket(newSocket);

    // Cleanup function
    return () => {
      console.log('Cleaning up Socket.IO connection...');
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  // Run only once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SocketIOContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketIOContext.Provider>
  );
};

export const useSocketIOContext = () => {
  const context = useContext(SocketIOContext);
  if (context === undefined) {
    throw new Error('useSocketIOContext must be used within a SocketIOProvider');
  }
  return context;
};
