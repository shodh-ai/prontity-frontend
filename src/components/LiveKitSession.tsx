'use client';

import {
  RoomContext,
  RoomAudioRenderer
} from '@livekit/components-react';
import { Room, Track, RoomEvent, LocalParticipant, RemoteParticipant } from 'livekit-client'; // Import necessary types
import { useEffect, useState, useCallback, useRef } from 'react';
import AgentController from '@/components/AgentController';
import LiveKitSessionUI from '@/components/LiveKitSessionUI';
import { getTokenEndpointUrl, tokenServiceConfig } from '@/config/services';
import '@livekit/components-styles';
import '@/app/speakingpage/figma-styles.css';
import '@/styles/figma-exact.css';
import '@/styles/enhanced-room.css';
import '@/styles/video-controls.css';
import '@/styles/livekit-session-ui.css';

import { PageType } from '@/components/LiveKitSessionUI';

// --- RPC IMPORTS ---
// NOTE: There is no 'livekit-rpc' package to import from for the client.
// RPC functionalities are part of 'livekit-client'.

import {
  AgentInteractionClientImpl, // This is your generated client class from ts-proto
} from '@/generated/protos/interaction'; // Adjust path if your generated file is elsewhere
import { FrontendButtonClickRequest } from '@/generated/protos/interaction'; // Import request message

// Helper functions for Base64 encoding/decoding Uint8Array <-> string
function uint8ArrayToBase64(buffer: Uint8Array): string {
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

// Interface that ts-proto generated clients expect
// (Matches the Rpc interface in the generated interaction.ts)
interface Rpc {
  request(service: string, method: string, data: Uint8Array): Promise<Uint8Array>;
}

export class LiveKitRpcAdapter implements Rpc {
  constructor(
    private localParticipant: LocalParticipant,
    private agentIdentity: string,
    // Default timeout for RPC calls (currently not directly configurable in performRpc call itself,
    // LiveKit's default is 10s. This parameter is kept for conceptual clarity or future SDK updates).
    private timeout: number = 10000, 
  ) {}

  async request(service: string, method: string, data: Uint8Array): Promise<Uint8Array> {
    // Convention: Use "serviceName/methodName" for LiveKit's performRpc method name
    // This allows the agent server to distinguish calls if it hosts multiple services/methods.
    const fullMethodName = `${service}/${method}`;
    const payloadString = uint8ArrayToBase64(data);

    try {
      console.log(`RPC Request: To=${this.agentIdentity}, Method=${fullMethodName}, Payload (base64)=${payloadString.substring(0,100)}...`);
      const responseString = await this.localParticipant.performRpc({
        destinationIdentity: this.agentIdentity,
        method: fullMethodName,
        payload: payloadString,
        // Note: The 'timeout' parameter is not directly part of PerformRpcParams in the current SDK version.
        // The call will use LiveKit's default timeout (10 seconds).
      });
      console.log(`RPC Response: From=${this.agentIdentity}, Method=${fullMethodName}, Response (base64)=${responseString.substring(0,100)}...`);
      return base64ToUint8Array(responseString);
    } catch (error) {
      console.error(`RPC request to ${fullMethodName} for ${this.agentIdentity} failed:`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`RPC failed: ${String(error)}`);
    }
  }
}

interface LiveKitSessionProps {
  roomName: string;
  userName: string;
  questionText?: string;
  sessionTitle?: string;
  onLeave?: () => void;
  pageType?: PageType;
  showTimer?: boolean;
  timerDuration?: number;
  customControls?: React.ReactNode;
  hideVideo?: boolean;
  hideAudio?: boolean;
  aiAssistantEnabled?: boolean;
  showAvatar?: boolean;
  onRoomCreated?: (room: Room) => void;
}

export default function LiveKitSession({
  roomName,
  userName,
  questionText,
  sessionTitle = "LiveKit Session",
  onLeave,
  pageType = 'default',
  showTimer = false,
  timerDuration = 45,
  customControls,
  hideVideo = false,
  hideAudio = false,
  aiAssistantEnabled = true,
  showAvatar = false,
  onRoomCreated
}: LiveKitSessionProps) {
  const [token, setToken] = useState('');
  const [audioInitialized, setAudioInitialized] = useState<boolean>(false);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [videoEnabled, setVideoEnabled] = useState<boolean>(!hideVideo);
  const [micHeartbeat, setMicHeartbeat] = useState<NodeJS.Timeout | null>(null);
  
  const [roomInstance] = useState(() => new Room({
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: {
      resolution: { width: 640, height: 480, frameRate: 30 }
    },
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    stopLocalTrackOnUnpublish: false
  }));

  // --- RPC STATE ---
  // We only need a ref for the typed service client.
  const agentServiceClientRef = useRef<AgentInteractionClientImpl | null>(null);
  const [rpcResponse, setRpcResponse] = useState<string>('');

  const handleLeave = useCallback(async () => {
    console.log('Leaving room...');
    await roomInstance.disconnect(true);
    if (onLeave) {
      onLeave();
    }
  }, [roomInstance, onLeave]);

  const toggleAudio = useCallback(() => { /* ... (same as your original) ... */ }, [roomInstance]);
  const toggleCamera = useCallback(async () => { /* ... (same as your original) ... */ }, [roomInstance, videoEnabled]);
  const enableMicrophone = useCallback(async () => { /* ... (same as your original, ensure roomInstance.localParticipant is checked) ... */ }, [roomInstance]);
  const initializeAudio = useCallback(() => { /* ... (same as your original) ... */ }, [hideAudio, enableMicrophone]);


  useEffect(() => {
    let mounted = true;

    const setupRpcClient = () => {
        if (roomInstance && roomInstance.state === 'connected' && roomInstance.localParticipant) {
            if (!agentServiceClientRef.current) {
                // This identity should match the one set in the Python agent (main.py)
                // when the avatar is not enabled.
                const AGENT_PARTICIPANT_IDENTITY = 'rox-custom-llm-agent';

                if (!roomInstance.localParticipant) {
                    console.warn('Local participant not available for RPC adapter setup. Cannot create LiveKitRpcAdapter.');
                    return; // Exit if localParticipant is not yet available
                }

                console.log(`Attempting to set up RPC with agent: ${AGENT_PARTICIPANT_IDENTITY}`);
                const livekitRpcAdapter = new LiveKitRpcAdapter(
                    roomInstance.localParticipant, 
                    AGENT_PARTICIPANT_IDENTITY
                );
                
                // AgentInteractionClientImpl is the service client generated by ts-proto
                agentServiceClientRef.current = new AgentInteractionClientImpl(livekitRpcAdapter);
                console.log('LiveKit RPC client (AgentInteractionClient) initialized using LiveKitRpcAdapter.');
            }
        } else {
            console.warn('Room not connected or local participant not available for RPC setup.');
        }
    };

    const setupRoomEvents = () => {
        roomInstance.on(RoomEvent.Connected, () => {
            console.log('RoomEvent.Connected: Local participant available. Attempting RPC setup.');
            setupRpcClient(); // Attempt to set up RPC client on connection
        });
        roomInstance.on(RoomEvent.Disconnected, () => {
            console.log('RoomEvent.Disconnected: Clearing RPC client.');
            agentServiceClientRef.current = null; // Clear client on disconnect
        });
        roomInstance.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
          console.log(`Participant connected: ${participant.identity}`);
        });
        roomInstance.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          // ... (your existing track subscription logic) ...
        });
    };

    const connectToRoom = async () => {
      if (token) return; 

      try {
        console.log(`Fetching token for room: ${roomName}, user: ${userName}`);
        const tokenUrl = getTokenEndpointUrl(roomName, userName);
        console.log('Attempting to fetch token from URL:', tokenUrl);
        const fetchOptions: RequestInit = { headers: {} };
        if (tokenServiceConfig.includeApiKeyInClient && tokenServiceConfig.apiKey) {
          (fetchOptions.headers as Record<string, string>)['x-api-key'] = tokenServiceConfig.apiKey;
        }
        const resp = await fetch(tokenUrl, fetchOptions);
        if (!resp.ok) throw new Error(`Failed to get token: ${resp.status} ${resp.statusText}`);
        const data = await resp.json();

        if (!mounted) return;
        
        if (data.token) {
          setToken(data.token);
          console.log('Token received, connecting to LiveKit room...');
          
          setupRoomEvents(); // Setup event listeners before connecting

          await roomInstance.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL || data.wsUrl, data.token);
          console.log('Successfully connected to LiveKit room.');
          // RPC client setup is now triggered by RoomEvent.Connected

          if (onRoomCreated) {
            onRoomCreated(roomInstance);
          }
          fetch(`/api/agent?room=${roomName}`).catch(e => console.error('Error starting AI agent:', e));
        } else {
          console.error('Failed to get token from API (no token in response)');
        }
      } catch (e) {
        console.error('Error in connectToRoom process:', e);
      }
    };
    
    if ((audioInitialized || hideAudio) && !token) {
        connectToRoom();
    }
    
    return () => {
      mounted = false;
      if (micHeartbeat) clearInterval(micHeartbeat);
      roomInstance.disconnect().then(() => console.log('Disconnected from LiveKit room on cleanup.'));
      agentServiceClientRef.current = null; // Clear ref on unmount
    };
  }, [roomInstance, roomName, userName, audioInitialized, hideAudio, token, onRoomCreated, micHeartbeat, enableMicrophone]);


  const handleRpcButtonClick = async () => {
    if (!agentServiceClientRef.current) {
      console.error('Agent RPC service client not initialized. Are you connected to the room?');
      setRpcResponse('RPC Client not ready. Ensure you are connected.');
      return;
    }
    try {
      const request = FrontendButtonClickRequest.create({
        buttonId: "myDynamicTestButton",
        customData: `Hello from ${userName} at ${new Date().toISOString()}`
      });
      console.log('Sending RPC request to agent:', request);
      setRpcResponse('Sending RPC call...');

      // The agent service is room-scoped, so no specific target participant is needed.
      const response = await agentServiceClientRef.current.HandleFrontendButton(request);
      
      console.log('RPC Response from agent:', response);
      setRpcResponse(`Agent says: ${response.statusMessage} (Payload: ${response.dataPayload || 'N/A'})`);
    } catch (error) {
      console.error('Error calling HandleFrontendButton RPC:', error);
      setRpcResponse(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // ... (Your existing conditional rendering for audio initialization and loading states) ...
  // Ensure this logic correctly leads to a state where `token` is set and `roomInstance` is connected.
  if (!audioInitialized && !hideAudio) {
    return (
      <div className="figma-room-container">
        <div className="figma-content">
          Initializing audio... Please allow microphone access if prompted.
        </div>
      </div>
    );
  }
  if (hideAudio && !audioInitialized) {
      useEffect(() => {
          if(hideAudio && !audioInitialized) {
              setAudioInitialized(true);
          }
      }, [hideAudio, audioInitialized]);
  }
  if (token === '' && (audioInitialized || hideAudio) ) {
     return <div className="figma-room-container"><div className="figma-content">Connecting to session...</div></div>;
  }
  if (!token && !audioInitialized && !hideAudio) {
    return <div className="figma-room-container"><div className="figma-content">Initializing audio and connecting...</div></div>;
  }
  if (!token || (!audioInitialized && !hideAudio) || roomInstance.state !== 'connected') {
      return <div className="figma-room-container"><div className="figma-content">Loading session... (State: {roomInstance.state})</div></div>;
  }


  return (
    <RoomContext.Provider value={roomInstance}>
      <LiveKitSessionUI
        token={token}
        pageType={pageType}
        sessionTitle={sessionTitle}
        questionText={questionText}
        userName={userName}
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        hideAudio={hideAudio}
        hideVideo={hideVideo}
        showTimer={showTimer}
        timerDuration={timerDuration}
        toggleAudio={toggleAudio}
        toggleCamera={toggleCamera}
        handleLeave={handleLeave} // Now correctly defined
        customControls={customControls}
      >
        {aiAssistantEnabled && (audioInitialized || hideAudio) && (
          <div className="hidden">
            <AgentController 
              roomName={roomName} 
              pageType={pageType} 
              showAvatar={showAvatar}
            />
          </div>
        )}
        
        <RoomAudioRenderer />

        <div style={{ padding: '10px', background: '#f0f0f0', marginTop: '10px', textAlign: 'center', border: '1px solid #ccc' }}>
          <h4>Agent RPC Test</h4>
          <button onClick={handleRpcButtonClick} className="figma-button" disabled={!agentServiceClientRef.current || roomInstance.state !== 'connected'}>
            Trigger Agent RPC
          </button>
          <p style={{ marginTop: '5px', fontSize: 'small', color: '#333' }}>
            Agent RPC Response: <span style={{ fontWeight: 'bold' }}>{rpcResponse || '(No response yet)'}</span>
          </p>
        </div>

      </LiveKitSessionUI>
    </RoomContext.Provider>
  );
}