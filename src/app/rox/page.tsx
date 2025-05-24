'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Room, RoomEvent, RemoteParticipant, DataPacket_Kind } from 'livekit-client';
import SimpleTavusDisplay from '@/components/SimpleTavusDisplay';
import { getTokenEndpointUrl, tokenServiceConfig } from '@/config/services';
import AgentTextInput from '@/components/ui/AgentTextInput';
// Import other UI components if needed, e.g., Button from '@/components/ui/button';
import StudentStatusDisplay from '@/components/StudentStatusDisplay';
import { Button } from '@/components/ui/button'; // Assuming you have a Button component
import LiveKitSession, { LiveKitRpcAdapter } from '@/components/LiveKitSession'; // Import LiveKitRpcAdapter
import { FrontendButtonClickRequest, AgentResponse } from '@/generated/protos/interaction'; // Import message types

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

  const handleTestRpcCall = async () => {
    if (!liveKitRpcAdapterRef.current) {
      const errorMessage = "LiveKitRpcAdapter not available. Cannot call HandleFrontendButton.";
      console.error(errorMessage);
      setRpcCallStatus(errorMessage);
      return;
    }
    try {
      setRpcCallStatus('Sending RPC call...');
      const requestMessage = FrontendButtonClickRequest.create({
        buttonId: "test_rpc_button",
        customData: "Hello from frontend via LiveKitRpcAdapter!"
      });
      const serializedRequest = FrontendButtonClickRequest.encode(requestMessage).finish();

      console.log("Calling RPC: Service 'rox.interaction.AgentInteraction', Method 'HandleFrontendButton' with request:", requestMessage);
      
      const serializedResponse = await liveKitRpcAdapterRef.current.request(
        "rox.interaction.AgentInteraction", // Fully qualified service name from proto package and service
        "HandleFrontendButton",
        serializedRequest
      );
      
      const responseMessage = AgentResponse.decode(serializedResponse);
      console.log("RPC Response from HandleFrontendButton:", responseMessage);
      
      const successMessage = `RPC call successful: ${responseMessage.statusMessage || 'No status message'}. Data: ${responseMessage.dataPayload || 'No data'}`;
      setRpcCallStatus(successMessage);
    } catch (e) {
      const errorMessage = `Error calling HandleFrontendButton RPC: ${e instanceof Error ? e.message : String(e)}`;
      console.error(errorMessage, e);
      setRpcCallStatus(errorMessage);
    }
  };

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
          console.log('LiveKitRpcAdapter initialized with fallback identity. Will update when agent is detected.');
          
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
                      toggleStudentStatusDisplay();
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
                    toggleStudentStatusDisplay();
                  }
                });
            }
            // Further fallback for direct action/payload if it's a single action not in an array
            else if (message?.action === 'click' && message?.payload?.selector === '#statusViewButton') {
              console.log('Agent requested to toggle StudentStatusDisplay via #statusViewButton selector from single direct action');
              toggleStudentStatusDisplay();
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

  const toggleStudentStatusDisplay = () => {
    setIsStudentStatusDisplayOpen(!isStudentStatusDisplayOpen);
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
          <Image ref={docsIconRef} id="statusViewButton" src="/docs.svg" alt="Docs" width={24} height={24} className="cursor-pointer hover:opacity-75" onClick={toggleStudentStatusDisplay} />
        </div>
        {/* RPC Test Button - Placed in sidebar */}
        {isConnected && room && (
          <div className="mt-auto mb-4 w-full flex flex-col items-center">
            <Button 
              onClick={handleTestRpcCall} 
              variant="outline"
              className="w-full px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md truncate"
            >
              Test RPC
            </Button>
            {rpcCallStatus && <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 text-center w-full break-words">{rpcCallStatus}</p>}
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 relative">
        {/* Avatar Display - Centered */} 
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ top: '30%' }}>
            {isConnected && room ? (
                <SimpleTavusDisplay room={room} />
            ) : (
                <div className="w-40 h-40 bg-slate-200 rounded-full flex items-center justify-center text-gray-700">
                  {error && <p className="text-red-500">Error: {error}</p>}
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

        <StudentStatusDisplay 
          isOpen={isStudentStatusDisplayOpen} 
          anchorElement={docsIconRef.current} 
          onClose={toggleStudentStatusDisplay} 
        />
      </main>
    </div>
  );
}
