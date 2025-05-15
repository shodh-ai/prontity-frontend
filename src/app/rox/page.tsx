'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Room, RoomEvent } from 'livekit-client';
import SimpleTavusDisplay from '@/components/SimpleTavusDisplay';
import { getTokenEndpointUrl, tokenServiceConfig } from '@/config/services';
import AgentTextInput from '@/components/ui/AgentTextInput';
// Import other UI components if needed, e.g., Button from '@/components/ui/button';

export default function RoxPage() {
  const [token, setToken] = useState<string>('');
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  const roomRef = useRef<Room | null>(null);

  const roomName = 'Roxpage'; // Or dynamically set if needed
  const userName = 'TestUser'; // Or dynamically set if needed

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const tokenUrl = getTokenEndpointUrl(roomName, userName);
        const fetchOptions: RequestInit = { headers: {} };
        if (tokenServiceConfig.includeApiKeyInClient && tokenServiceConfig.apiKey) {
          (fetchOptions.headers as Record<string, string>)['x-api-key'] = tokenServiceConfig.apiKey;
        }
        const resp = await fetch(tokenUrl, fetchOptions);
        if (!resp.ok) throw new Error(`Token service error: ${resp.status}`);
        const data = await resp.json();
        if (data.token) setToken(data.token);
        else throw new Error('No token in response');
      } catch (err) {
        setError((err as Error).message);
      }
    };
    fetchToken();
  }, [roomName, userName]);

  useEffect(() => {
    if (!token || room) return; // Don't connect if no token or already connected/connecting

    const connect = async () => {
      const newRoomInstance = new Room();
      
      newRoomInstance.on(RoomEvent.Connected, () => {
        console.log('Connected to LiveKit room:', newRoomInstance.name);
        setIsConnected(true);
        setRoom(newRoomInstance); // Update state for rendering
        roomRef.current = newRoomInstance; // Store in ref for cleanup
      });

      newRoomInstance.on(RoomEvent.Disconnected, () => {
        console.log('Disconnected from LiveKit room');
        setIsConnected(false);
        setRoom(null);
        if (roomRef.current === newRoomInstance) {
          roomRef.current = null;
        }
      });

      try {
        await newRoomInstance.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL || '', token, {
          autoSubscribe: true, // Automatically subscribe to all tracks
        });
      } catch (err) {
        setError(`Failed to connect: ${(err as Error).message}`);
        setRoom(null); // Ensure state room is null on failed connection
        roomRef.current = null; // Ensure ref is also null
      }
    };

    if (token && !roomRef.current) { // Only connect if token exists and not already connected/connecting
      connect();
    }

    return () => {
      console.log('Cleaning up LiveKit room connection');
      roomRef.current?.disconnect();
      roomRef.current = null; // Clear the ref on cleanup
    };
  }, [token]); // Effect dependencies

  const handleSendMessageToAgent = () => {
    if (userInput.trim()) {
      console.log('Sending to agent:', userInput);
      // TODO: Add Socket.IO or LiveKit agent communication logic here
      setUserInput(''); // Clear input after sending
    }
  };

  const handleDisconnect = () => {
    roomRef.current?.disconnect(); // Use ref for manual disconnect as well
    // State will update via RoomEvent.Disconnected listener
  };

  return (
    <div className="flex h-screen bg-white text-gray-800 overflow-hidden bg-[image:radial-gradient(ellipse_at_top_right,_#B7C8F3_0%,_transparent_70%),_radial-gradient(ellipse_at_bottom_left,_#B7C8F3_0%,_transparent_70%)]">
      {/* Sidebar */}
      <aside className="w-20 p-4 flex flex-col items-center space-y-6">
        <Image src="/final-logo-1.png" alt="Logo" width={32} height={32} className="rounded-lg" />
        <div className="flex-grow flex flex-col items-center justify-center space-y-4">
          <Image src="/user.svg" alt="User Profile" width={24} height={24} className="cursor-pointer hover:opacity-75" />
          <Image src="/mic-on.svg" alt="Mic On" width={24} height={24} className="cursor-pointer hover:opacity-75" />
          <Image src="/next.svg" alt="Next" width={24} height={24} className="cursor-pointer hover:opacity-75" />
          <Image src="/docs.svg" alt="Docs" width={24} height={24} className="cursor-pointer hover:opacity-75" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 relative">
        {/* Avatar Display - Centered */} 
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ top: '30%' }}>
            {isConnected && room ? (
                <SimpleTavusDisplay room={room} />
            ) : (
                <div className="w-40 h-40 bg-slate-200 rounded-full flex items-center justify-center text-gray-700">
                    <p className="text-sm">{error ? 'Error' : (token ? 'Connecting...' : 'No Token')}</p>
                </div>
            )}
        </div>

        <div className="w-full max-w-3xl absolute bottom-0 mb-12 flex flex-col items-center">
            <p className="text-xl mb-6 text-gray-600" style={{ marginTop: '100px' }}>Hello, I am Rox, your AI Assistant!</p>
            
            {/* Input Area */}
            <div className="w-full bg-white border border-gray-300 rounded-xl p-1 flex items-center shadow-xl relative" style={{ minHeight: '56px' }}>
              <AgentTextInput
                value={userInput}
                onChange={setUserInput} // Pass setUserInput directly
                onSubmit={handleSendMessageToAgent} // Use the new submit handler
                placeholder="Ask me anything!"
                className="flex-grow bg-transparent border-none focus:ring-0 resize-none text-gray-800 placeholder-gray-500 p-3 leading-tight"
                rows={1}
              />
            </div>

            {/* Suggestion Boxes */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
              {[ "Summarize my learning so far, what have I covered and how well?", "Improve my speaking skills where am I lacking and how to fix it?", "Show me my mistakes and how I can improve them."].map((text, i) => (
                <div key={i} onClick={() => setUserInput(text)} className="bg-white border border-gray-200 p-4 rounded-lg hover:bg-gray-50 cursor-pointer transition-all">
                  <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
        </div>

        {/* Error display - optional, can be placed elsewhere */}
        {error && (
          <div className="absolute top-4 right-4 p-3 bg-red-500 text-white rounded-md shadow-lg">
            Error: {error}
          </div>
        )}
        {/* Disconnect button - optional, can be placed elsewhere or removed */}
        {isConnected && (
             <button 
              onClick={handleDisconnect}
              className="absolute top-4 left-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
            >
              Disconnect
            </button>
        )}

      </main>
    </div>
  );
}
