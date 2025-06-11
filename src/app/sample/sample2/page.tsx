'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  DataPacket_Kind,
  LocalParticipant, // For type hints
  RpcError,         // For error handling in registration
  RpcInvocationData, // For RPC method signature
} from 'livekit-client';
import { getTokenEndpointUrl, tokenServiceConfig } from '@/config/services';
import AgentTextInput from '@/components/ui/AgentTextInput';
// Import other UI components if needed, e.g., Button from '@/components/ui/button';
import StudentStatusDisplay from '@/components/StudentStatusDisplay';
import { Button } from '@/components/ui/button'; // Assuming you have a Button component
import LiveKitSession, { LiveKitRpcAdapter } from '@/components/LiveKitSession'; // Import LiveKitRpcAdapter
import AudioHandler from '@/components/Audiorendering'; // Import AudioHandler
import {
  FrontendButtonClickRequest, // Existing F2B
  AgentResponse,             // Existing F2B
  // Add these for B2F
  AgentToClientUIActionRequest,
  ClientUIActionResponse,
  ClientUIActionType,
  NotifyPageLoadRequest,   // For F2B Page Load Notification
  HighlightRangeProto, // Added for text highlighting payload
} from '@/generated/protos/interaction';

// Helper functions for Base64
function uint8ArrayToBase64(buffer: Uint8Array): string {
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary); // btoa is a standard browser function
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary_string = atob(base64); // atob is a standard browser function
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

export default function RoxPage() {
  const [token, setToken] = useState<string>('');
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  const [rpcCallStatus, setRpcCallStatus] = useState<string>('');
  const roomRef = useRef<Room | null>(null);
  const [isStudentStatusDisplayOpen, setIsStudentStatusDisplayOpen] = useState(false);
  const docsIconRef = useRef<HTMLImageElement>(null);
  const liveKitRpcAdapterRef = useRef<LiveKitRpcAdapter | null>(null);


  const roomName = 'Roxpage'; // Or dynamically set if needed
  const userName = 'TestUser'; // Or dynamically set if needed

  

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const tokenUrl = getTokenEndpointUrl(roomName, userName);
        console.log('[rox/page.tsx] Attempting to fetch token from URL:', tokenUrl);
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

        // Setup RPC client once connected
        if (newRoomInstance.localParticipant) {
          // Initialize RPC adapter with a fallback identity first - we'll update it when we detect the agent
          const fallbackAgentIdentity = "rox-custom-llm-agent"; // Fallback identity
          liveKitRpcAdapterRef.current = new LiveKitRpcAdapter(newRoomInstance.localParticipant, fallbackAgentIdentity);



          // Setup a listener for when participants join to identify the agent
          newRoomInstance.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
            console.log(`New participant connected: ${participant.identity}`);
            if (participant.identity !== newRoomInstance.localParticipant.identity) {
              // This is likely the agent
              console.log(`Found agent with identity: ${participant.identity}`);
              // Update the RPC adapter with the correct agent identity
              if (liveKitRpcAdapterRef.current) {
                liveKitRpcAdapterRef.current = new LiveKitRpcAdapter(
                  newRoomInstance.localParticipant, 
                  participant.identity
                );
                console.log('LiveKitRpcAdapter updated with detected agent identity.');
              }
            }
          });
          
          // Also check if there are already remote participants in the room
          // In some LiveKit versions, we need to use .remoteParticipants instead of .participants
          const remoteParticipantsMap = newRoomInstance.remoteParticipants || 
                                     (newRoomInstance as any).participants;
                                     
          if (remoteParticipantsMap && typeof remoteParticipantsMap.values === 'function') {
            try {
              const remoteParticipants = Array.from(remoteParticipantsMap.values()) as RemoteParticipant[];
              console.log('Remote participants already in room:', remoteParticipants.map(p => p.identity));
              
              // Find the first participant that's not us
              const agentParticipant = remoteParticipants.find(p => 
                p.identity !== newRoomInstance.localParticipant.identity
              );
              
              if (agentParticipant) {
                console.log(`Found existing agent with identity: ${agentParticipant.identity}`);
                // Update the RPC adapter with the correct agent identity
                liveKitRpcAdapterRef.current = new LiveKitRpcAdapter(
                  newRoomInstance.localParticipant, 
                  agentParticipant.identity
                );
                console.log('LiveKitRpcAdapter updated with existing agent identity.');
              }
            } catch (err) {
              console.warn('Error checking existing participants:', err);
            }
          } else {
            console.log('No remote participants collection available yet or it doesn\'t have a values() method');
          }
        } else {
          console.error('LocalParticipant not available after connection, cannot set up RPC client.');
        }
      });

      newRoomInstance.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant, kind?: DataPacket_Kind, topic?: string) => {
        if (participant) {
          console.log(`Received data from participant ${participant.identity} (kind: ${kind}, topic: ${topic})`);
          try {
            const messageStr = new TextDecoder().decode(payload);
            const message = JSON.parse(messageStr);
            console.log('Decoded message:', message);

            // Check for chat messages with metadata carrying dom_actions
            // The structure might depend on how CustomLLMBridge wraps it.
            // Assuming it's a ChatChunk-like structure or similar.
            if (message?.delta?.metadata?.dom_actions) {
              const domActionsStr = message.delta.metadata.dom_actions;
              try {
                const domActions = JSON.parse(domActionsStr);
                if (Array.isArray(domActions)) {
                  domActions.forEach((actionItem: any) => {
                    console.log('Processing DOM action from metadata:', actionItem);
                    if (actionItem.action === 'click' && actionItem.payload?.selector === '#statusViewButton') {
                      console.log('Agent requested to toggle StudentStatusDisplay via #statusViewButton selector from metadata');
             
                    } else if (actionItem.action === 'click' && actionItem.payload?.selector) {
                      console.log(`Agent requested click on other selector from metadata: ${actionItem.payload.selector}`);
                      // Potentially handle other selectors if needed in the future, e.g., #startLearningButton
                    }
                  });
                }
              } catch (e) {
                console.error('Failed to parse dom_actions from metadata:', e);
              }
            }
            // Fallback: Check for simpler action/payload structure directly if CustomLLMBridge might send it this way.
            // This is based on rox_agent.py returning dom_actions directly in its JSON response.
            // CustomLLMBridge might pick this up and send it without the delta/metadata wrapper in some configurations.
            else if (message?.dom_actions && Array.isArray(message.dom_actions)) {
                message.dom_actions.forEach((actionItem: any) => {
                  console.log('Processing DOM action from direct message property:', actionItem);
                  if (actionItem.action === 'click' && actionItem.payload?.selector === '#statusViewButton') {
                    console.log('Agent requested to toggle StudentStatusDisplay via #statusViewButton selector from direct message property');
                  }
                });
            }

          } catch (e) {
            console.error('Failed to parse data packet:', e);
          }
        }
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
        </div>
        
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center p-8 relative">
          {isConnected && room && <AudioHandler room={room} />}



        <div className="w-full max-w-3xl absolute bottom-0 mb-12 flex flex-col items-center">
            

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
