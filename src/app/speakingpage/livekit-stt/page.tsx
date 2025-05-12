'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LiveKitSTTClient } from './LiveKitSTTClient';

export default function LiveKitSTTPage() {
  const [roomName, setRoomName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [wsUrl, setWsUrl] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const router = useRouter();

  // Generate a random room name and username if not provided
  useEffect(() => {
    if (!roomName) {
      setRoomName(`stt-room-${Math.floor(Math.random() * 100000)}`);
    }
    if (!username) {
      setUsername(`user-${Math.floor(Math.random() * 100000)}`);
    }
  }, [roomName, username]);

  // Function to get token from webrtc-token-service
  const getToken = async () => {
    try {
      const response = await fetch(`/api/get-livekit-token?room=${roomName}&username=${username}`);
      const data = await response.json();
      
      if (data.token && data.wsUrl) {
        setToken(data.token);
        setWsUrl(data.wsUrl);
        setIsConnected(true);
      } else {
        console.error('Failed to get token:', data);
      }
    } catch (error) {
      console.error('Error getting token:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-6">LiveKit Speech-to-Text</h1>
        
        {!isConnected ? (
          <div className="mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Room Name</label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-2 border rounded"
              />
            </div>
            <button
              onClick={getToken}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Start Speaking Session
            </button>
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={() => setIsConnected(false)}
              className="absolute top-0 right-0 bg-red-600 text-white px-3 py-1 rounded text-sm"
            >
              Disconnect
            </button>
            <LiveKitSTTClient token={token} wsUrl={wsUrl} roomName={roomName} username={username} />
          </div>
        )}
      </div>
    </div>
  );
}
