'use client';

import React, { useState, useEffect } from 'react';
import { Room } from 'livekit-client';
import SimpleTavusDisplay from '@/components/SimpleTavusDisplay';
import { getTokenEndpointUrl, tokenServiceConfig } from '@/config/services';

export default function TavusTestPage() {
  const [token, setToken] = useState<string>('');
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  
  const roomName = 'Roxpage';
  const userName = 'TestUser';
  
  // Add to log
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLog(prev => [...prev, `${timestamp}: ${message}`]);
  };
  
  // Fetch token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        // Use the dedicated token service URL from config
        addLog('Fetching token...');
        const tokenUrl = getTokenEndpointUrl(roomName, userName);
        addLog(`Using token URL: ${tokenUrl}`);
        
        // Setup request options including API key header if configured
        const fetchOptions: RequestInit = {
          headers: {}
        };
        
        if (tokenServiceConfig.includeApiKeyInClient && tokenServiceConfig.apiKey) {
          (fetchOptions.headers as Record<string, string>)['x-api-key'] = tokenServiceConfig.apiKey;
          addLog('Including API key in request');
        }
        
        // Fetch token from dedicated service
        const resp = await fetch(tokenUrl, fetchOptions);
        
        if (!resp.ok) {
          throw new Error(`Token service returned ${resp.status}: ${resp.statusText}`);
        }
        
        const data = await resp.json();
        
        if (data.token) {
          setToken(data.token);
          addLog('Token fetched successfully');
        } else {
          throw new Error('No token in response');
        }
      } catch (err) {
        const errorMsg = `Error fetching token: ${(err as Error).message}`;
        setError(errorMsg);
        addLog(errorMsg);
      }
    };
    
    fetchToken();
  }, [roomName, userName]);
  
  // Connect to LiveKit room
  const connectToRoom = async () => {
    if (!token) {
      setError('No token available');
      return;
    }
    
    try {
      addLog('Creating room instance...');
      const newRoom = new Room();
      setRoom(newRoom);
      
      // Set up event listeners for debugging
      newRoom.on('connected', () => {
        addLog('Connected to room!');
        setIsConnected(true);
      });
      
      newRoom.on('disconnected', () => {
        addLog('Disconnected from room');
        setIsConnected(false);
      });
      
      newRoom.on('participantConnected', (participant) => {
        addLog(`Participant connected: ${participant.identity}`);
      });
      
      newRoom.on('participantDisconnected', (participant) => {
        addLog(`Participant disconnected: ${participant.identity}`);
      });
      
      newRoom.on('trackSubscribed', (track, publication, participant) => {
        addLog(`Track subscribed: ${publication.trackName || 'unnamed'} (${track.kind}) from ${participant.identity}`);
      });
      
      // Connect to the room
      addLog(`Connecting to ${roomName}...`);
      await newRoom.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL || '', token);
      addLog(`Successfully connected to ${newRoom.name}`);
      
    } catch (err) {
      const errorMsg = `Error connecting to room: ${(err as Error).message}`;
      setError(errorMsg);
      addLog(errorMsg);
    }
  };
  
  // Disconnect from the room
  const disconnectFromRoom = () => {
    if (room) {
      room.disconnect();
      setRoom(null);
      setIsConnected(false);
      addLog('Disconnected from room');
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-center">Tavus Avatar Simplified Test</h1>
      
      <div className="mb-6">
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
          <p className="text-blue-700">
            <strong>Important:</strong> Make sure the LiveKit agent is running with avatar support:
          </p>
          <pre className="mt-2 bg-gray-100 p-2 rounded text-sm overflow-x-auto">
            python main.py connect --room Roxpage --page-path roxpage
          </pre>
        </div>
        
        <div className="flex justify-center space-x-4">
          {!isConnected ? (
            <button 
              onClick={connectToRoom}
              disabled={!token}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:bg-gray-400"
            >
              Connect to Room
            </button>
          ) : (
            <button 
              onClick={disconnectFromRoom}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
            >
              Disconnect
            </button>
          )}
        </div>
        
        {error && (
          <div className="mt-4 p-3 bg-red-100 text-red-800 rounded">
            {error}
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Avatar Display */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="bg-purple-600 text-white p-4">
            <h2 className="text-xl font-semibold">Tavus Avatar Video</h2>
          </div>
          
          <div className="p-4">
            <div style={{ height: '320px' }}>
              {room ? (
                <SimpleTavusDisplay room={room} />
              ) : (
                <div className="flex items-center justify-center h-full bg-gray-100 rounded">
                  <p className="text-gray-500">Connect to room to see avatar</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Log Panel */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="bg-gray-800 text-white p-4">
            <h2 className="text-xl font-semibold">Connection Log</h2>
          </div>
          
          <div className="p-4">
            <div className="bg-black text-green-400 font-mono text-sm p-3 rounded h-[320px] overflow-y-auto">
              {log.length === 0 ? (
                <div>Waiting for events...</div>
              ) : (
                log.map((entry, i) => (
                  <div key={i}>{entry}</div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Room Information */}
      {isConnected && room && (
        <div className="mt-6 bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="bg-gray-800 text-white p-4">
            <h2 className="text-xl font-semibold">Room Information</h2>
          </div>
          
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium">Room Name:</h3>
                <p className="text-gray-700">{room.name}</p>
              </div>
              
              <div>
                <h3 className="font-medium">Connection State:</h3>
                <p className="text-gray-700">{room.state}</p>
              </div>
              
              <div>
                <h3 className="font-medium">Local Participant:</h3>
                <p className="text-gray-700">{room.localParticipant?.identity}</p>
              </div>
              
              <div>
                <h3 className="font-medium">Remote Participants:</h3>
                <p className="text-gray-700">
                  {Array.from(room.remoteParticipants.values()).length > 0 
                    ? Array.from(room.remoteParticipants.values()).map(p => p.identity).join(', ') 
                    : 'None'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
