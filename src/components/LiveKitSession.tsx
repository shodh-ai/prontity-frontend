'use client';

import {
  RoomContext,
  RoomAudioRenderer
} from '@livekit/components-react';
import { Room, RoomEvent, LocalParticipant, RemoteParticipant, RpcError, RpcInvocationData, ConnectionState } from 'livekit-client'; // Import necessary types
import { useEffect, useState, useCallback, useRef } from 'react';
import { getTokenEndpointUrl, tokenServiceConfig } from '@/config/services';
import '@/styles/livekit-session-ui.css';

// --- RPC IMPORTS ---
// NOTE: There is no 'livekit-rpc' package to import from for the client.
// RPC functionalities are part of 'livekit-client'.

import {
  AgentInteractionClientImpl, // This is your generated client class from ts-proto
  AgentToClientUIActionRequest,
  ClientUIActionResponse,
  ClientUIActionType, // Import the enum
   // Import for the new payload type
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

export type PageType = 'default' | 'assessment' | 'practice' | 'custom'; // Define PageType

let hasConnectedSuccessfully = false;
let apiCallAttempted = false;
let cachedTokenData: { studentToken: string; livekitUrl: string; roomName: string; [key: string]: any; } | null = null;

// A single room instance, created once per page load, to survive React's Strict Mode re-mounts.
const roomInstance = new Room({
  adaptiveStream: true,
  dynacast: true,
  videoCaptureDefaults: {
    resolution: { width: 640, height: 480, frameRate: 30 },
  },
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  stopLocalTrackOnUnpublish: false,
});

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
  onConnected?: (room: Room, rpcAdapter: LiveKitRpcAdapter) => void;
  onPerformUIAction?: (data: RpcInvocationData) => Promise<string>;
}

export default function LiveKitSession({
  // ... (props definition)
  // Inserted log:
  // console.log('[LiveKitSession] Component rendering with props:', { roomName, userName, questionText, sessionTitle, pageType, showTimer, timerDuration, hideVideo, hideAudio, aiAssistantEnabled, showAvatar });

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
  onRoomCreated,
  onConnected,
  onPerformUIAction,
}: LiveKitSessionProps) {
  console.log('[LiveKitSession] Component rendering. Props received:', { roomName, userName });
  // State for UI elements that might be controlled by React state
  const [agentUpdatableTextState, setAgentUpdatableTextState] = useState("Initial text here. Agent can change me!");
  const [isAgentElementVisible, setIsAgentElementVisible] = useState(true);
  const liveKitRpcAdapterRef = useRef<LiveKitRpcAdapter | null>(null);

  const [token, setToken] = useState('');
  const [audioInitialized, setAudioInitialized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initializing session...");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [videoEnabled, setVideoEnabled] = useState<boolean>(!hideVideo);
  const [micHeartbeat, setMicHeartbeat] = useState<NodeJS.Timeout | null>(null);
  


  // --- RPC STATE ---
  // We only need a ref for the typed service client.
  const agentServiceClientRef = useRef<AgentInteractionClientImpl | null>(null);
  const [rpcResponse, setRpcResponse] = useState<string>('');

  // --- New UI States for Agent Control ---
  type UiTimerStateType = {[timerId: string]: { isRunning: boolean; isPaused: boolean; timeLeft: number; totalDuration: number; timerType: string; }};
  const [uiTimerState, setUiTimerState] = useState<UiTimerStateType>({});

  type UiProgressStateType = {[indicatorId: string]: { currentStep: number; totalSteps: number; message?: string; }};
  const [uiProgressState, setUiProgressState] = useState<UiProgressStateType>({});

  type UiScoreStateType = {[displayId: string]: { scoreText: string; progressPercentage?: number; }};
  const [uiScoreState, setUiScoreState] = useState<UiScoreStateType>({});

  type UiButtonPropertiesType = {[buttonId: string]: { label?: string; disabled?: boolean; taskData?: any; styleClass?: string; }};
  const [uiButtonProperties, setUiButtonProperties] = useState<UiButtonPropertiesType>({});

  type UiButtonOptionsType = {[panelId: string]: Array<{label: string, actionContextUpdate: any}>};
  const [uiButtonOptions, setUiButtonOptions] = useState<UiButtonOptionsType>({});

  type UiAudioCueType = string | null;
  const [uiAudioCue, setUiAudioCue] = useState<UiAudioCueType>(null);

  type UiLoadingIndicatorsType = {[indicatorId: string]: { isLoading: boolean; message?: string; }};
  const [uiLoadingIndicators, setUiLoadingIndicators] = useState<UiLoadingIndicatorsType>({});

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

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


    // Effect for fetching token and establishing initial connection
  useEffect(() => {
    console.log('[LiveKitSession] Main connection useEffect triggered. roomName:', roomName, 'userName:', userName);
    let mounted = true; // To prevent state updates on unmounted component

    const fetchTokenAndConnect = async () => {
      if (!mounted) return;

      // Critical: Ensure roomName and userName are present before proceeding
      if (!roomName || !userName) {
        console.error('[LiveKitSession] RoomName and UserName are required for connection.');
        if (mounted) {
          setConnectionError("RoomName and UserName are required.");
          setIsLoading(false);
        }
        return;
      }

      // Guard 1: If already successfully connected and room is in a connected state, do nothing.
      if (hasConnectedSuccessfully && roomInstance.state === ConnectionState.Connected) {
        console.log('[LiveKitSession] Already successfully connected. Skipping further action.');
        if (mounted) setIsLoading(false); // Ensure loading is off if somehow still true
        return;
      }

      // Guard 2: If a connection attempt is already in progress by this roomInstance, skip.
      if (roomInstance.state === ConnectionState.Connecting) {
        console.log('[LiveKitSession] Connection already in progress by this room instance. Skipping.');
        return;
      }

      let currentTokenData = cachedTokenData;

      if (!apiCallAttempted) {
        console.log('[LiveKitSession] First attempt to fetch token in this component lifecycle for room:', roomName, 'user:', userName);
        if (mounted) {
          setIsLoading(true);
          setConnectionError(null);
        }
        apiCallAttempted = true; // Mark that API call is being attempted for this page load/component lifecycle

        try {
          const backendUrl = new URL('http://localhost:8000/api/generate-token');
          backendUrl.searchParams.append('roomName', roomName);
          backendUrl.searchParams.append('userName', userName);

          const requestHeaders: HeadersInit = {};
          const pronityAuthToken = localStorage.getItem('authToken'); // Or your specific localStorage key for the auth token
          if (pronityAuthToken) {
            requestHeaders['Authorization'] = `Bearer ${pronityAuthToken}`;
          }

          const response = await fetch(backendUrl.toString(), {
            method: 'GET',
            headers: requestHeaders,
          });

          if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = `Error fetching token: ${errorData.message || response.statusText}`;
            console.error(`[LiveKitSession] ${errorMessage}`);
            if (mounted) setConnectionError(errorMessage);
            cachedTokenData = null; // Ensure no stale data on error
            if (mounted) setIsLoading(false);
            return;
          }
          const data = await response.json();
          console.log('[LiveKitSession] Raw token API response data:', data);
          cachedTokenData = data; // Cache successful token response
          currentTokenData = data;
          console.log('[LiveKitSession] Token received:', data.studentToken ? 'OK' : 'Missing', 'Room:', data.roomName);
        } catch (error: any) {
          const errorMessage = `Network error fetching token: ${error.message}`;
          console.error(`[LiveKitSession] ${errorMessage}`, error);
          if (mounted) setConnectionError(errorMessage);
          cachedTokenData = null; // Ensure no stale data on error
          if (mounted) setIsLoading(false);
          return;
        }
      } else if (cachedTokenData) {
        console.log('[LiveKitSession] API call previously attempted. Using cached token data for room:', cachedTokenData.roomName);
        currentTokenData = cachedTokenData;
        if (roomInstance.state === ConnectionState.Disconnected && mounted) {
            setIsLoading(true);
            setConnectionError(null); // Clear previous errors before new attempt
        }
      } else {
        console.log('[LiveKitSession] API call previously attempted but failed to get token (no cached data). Not proceeding.');
        if (mounted) {
            if (!connectionError) setConnectionError('Previous attempt to fetch token failed. Please refresh.');
            setIsLoading(false);
        }
        return;
      }

      if (!currentTokenData || !currentTokenData.studentToken) {
        console.error('[LiveKitSession] No token available to connect.');
        if (mounted) {
            setConnectionError('No token available for connection.');
            setIsLoading(false);
        }
        return;
      }

      if (roomInstance.state === ConnectionState.Disconnected) {
        console.log(`[LiveKitSession] Attempting to connect with token for room: ${currentTokenData.roomName}`);
        if (mounted && !isLoading) setIsLoading(true); // Ensure loading is true before connect
        try {
          const livekitWsUrl = currentTokenData.livekitUrl || process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';
          await roomInstance.connect(livekitWsUrl, currentTokenData.studentToken);
          console.log('[LiveKitSession] roomInstance.connect call initiated. Waiting for connection events.');
        } catch (error: any) {
          const connectErrorMessage = `Error during roomInstance.connect call: ${error.message}`;
          console.error(`[LiveKitSession] ${connectErrorMessage}`, error);
          if (mounted) setConnectionError(connectErrorMessage);
          hasConnectedSuccessfully = false;
          if (mounted) setIsLoading(false);
        }
      } else {
        console.log('[LiveKitSession] Room is not in Disconnected state, connect call skipped. Current state:', roomInstance.state);
        if (isLoading && mounted) setIsLoading(false);
      }
    };

    fetchTokenAndConnect();

    return () => {
      mounted = false;
      if (micHeartbeat) {
        clearInterval(micHeartbeat);
      }
    };
  }, [roomName, userName]);
  // Effect for managing room events, RPC client, and post-connection logic
  useEffect(() => {
    let mounted = true;

    // Helper function to set up the RPC adapter and notify the parent page.
    // This prevents code duplication.
    const setupRpcForAgent = (agentParticipant: RemoteParticipant) => {
        if (!mounted || !roomInstance.localParticipant || liveKitRpcAdapterRef.current) {
          // Don't set up if component unmounted, local user isn't present, or already set up.
          return;
        }

        console.log(`[LiveKitSession] Found agent with identity: ${agentParticipant.identity}. Setting up RPC.`);
        
        const adapter = new LiveKitRpcAdapter(
            roomInstance.localParticipant,
            agentParticipant.identity // Use the DISCOVERED identity
        );
        liveKitRpcAdapterRef.current = adapter;

        // Now that the adapter is correctly configured, notify the parent component.
        if (onConnected) {
          onConnected(roomInstance, adapter);
        }
    };

    const handleConnected = () => {
      if (!mounted) return;
      console.log(`[LiveKitSession] Successfully connected to LiveKit room: ${roomInstance.name}`);
      setIsLoading(false);
      setConnectionError(null);

      // --- AGENT DISCOVERY LOGIC (from rox/page.tsx) ---
      // Check if an agent is *already* in the room when we connect.
      roomInstance.remoteParticipants.forEach(participant => {
        // Simple heuristic: the first remote participant is the agent.
        // You can make this more robust by checking metadata if needed.
        if (!liveKitRpcAdapterRef.current) {
           setupRpcForAgent(participant);
        }
      });
      
      // ... your other on-connection logic (mic enable, etc.) ...
      if (!hideAudio) {
        roomInstance.localParticipant?.setMicrophoneEnabled(true)
          .then(() => { if (mounted) setAudioEnabled(true); });
      }
    };

    // This listener handles agents that join *after* we have connected.
    const onParticipantConnected = (participant: RemoteParticipant) => {
        console.log(`[LiveKitSession] Participant connected: ${participant.identity}`);
        // If we haven't found an agent yet, this new participant must be it.
        if (!liveKitRpcAdapterRef.current) {
            setupRpcForAgent(participant);
        }
    };

    const handleDisconnected = () => {
      if (!mounted) return;
      console.log('[LiveKitSession] Disconnected from LiveKit room.');
      // Reset state on disconnect
      liveKitRpcAdapterRef.current = null; 
      setIsLoading(false);
      setToken('');
    };

    roomInstance.on(RoomEvent.Connected, handleConnected);
    roomInstance.on(RoomEvent.Disconnected, handleDisconnected);
    roomInstance.on(RoomEvent.ParticipantConnected, onParticipantConnected);

    // Initial check in case we are already connected (e.g., hot reload)
    if (roomInstance.state === ConnectionState.Connected) {
        handleConnected();
    }

    return () => {
      mounted = false;
      roomInstance.off(RoomEvent.Connected, handleConnected);
      roomInstance.off(RoomEvent.Disconnected, handleDisconnected);
      roomInstance.off(RoomEvent.ParticipantConnected, onParticipantConnected);
    };
  }, [onConnected, hideAudio]); // Simplified dependency array


    useEffect(() => {
    // This is the function that will be registered as the RPC handler.
    const handlePerformUIAction = async (
      data: RpcInvocationData
    ): Promise<string> => {
      console.log('[LiveKitSession] B2F RPC (handlePerformUIAction) invoked by agent.');
      
      // If the parent page provided a custom handler, use it.
      if (onPerformUIAction) {
        console.log('[LiveKitSession] Delegating RPC handling to parent component.');
        return onPerformUIAction(data);
      }

      // --- FALLBACK: If no handler is provided, run a default/legacy implementation ---
      console.warn('[LiveKitSession] No onPerformUIAction handler provided by parent. Using fallback.');
      try {
        const response = ClientUIActionResponse.create({
          requestId: data.requestId,
          success: false,
          message: "No specific UI action handler implemented on this page.",
        });
        return uint8ArrayToBase64(ClientUIActionResponse.encode(response).finish());
      } catch (e) {
        // ... error handling ...
        const errMessage = e instanceof Error ? e.message : String(e);
        const errResponse = ClientUIActionResponse.create({ requestId: data.requestId, success: false, message: `Client error: ${errMessage}` });
        return uint8ArrayToBase64(ClientUIActionResponse.encode(errResponse).finish());
      }
    };

    // Register the handler when connected
    if (roomInstance && roomInstance.state === 'connected' && roomInstance.localParticipant) {
      const rpcMethodName = "rox.interaction.ClientSideUI/PerformUIAction";
      try {
        // We register OUR `handlePerformUIAction`, which then delegates to the parent.
        roomInstance.localParticipant.registerRpcMethod(rpcMethodName, handlePerformUIAction);
        console.log(`[LiveKitSession] Client RPC Handler registered for: ${rpcMethodName}`);
      } catch (e) {
        if (e instanceof RpcError && e.message.includes("already registered")) {
          console.warn(`[LiveKitSession] RPC method ${rpcMethodName} already registered. This might be due to hot reload.`);
        } else {
          console.error("[LiveKitSession] Failed to register client-side RPC handler 'PerformUIAction':", e);
        }
      }
    }

    // Cleanup logic (optional but good practice)
    return () => {
      // The unregister logic can be tricky with hot-reloads, so often it's left to the room disconnect to clean up.
    };
  }, [roomInstance.state, roomInstance.localParticipant, onPerformUIAction]);

  // Effect to play audio cues
  useEffect(() => {
    if (uiAudioCue && audioPlayerRef.current) {
      const soundMap: {[key: string]: string} = {
        'correct_answer_ding': '/sounds/correct_answer_ding.mp3',
        'error_buzz': '/sounds/error_buzz.mp3',
        'notification_pop': '/sounds/notification_pop.mp3',
        // Add more sound mappings as needed
      };
      if (soundMap[uiAudioCue]) {
        audioPlayerRef.current.src = soundMap[uiAudioCue];
        audioPlayerRef.current.play().catch(err => console.error('Error playing audio cue:', err));
      }
      setUiAudioCue(null); // Reset after attempting to play
    }
  }, [uiAudioCue]);








  return (
    <RoomContext.Provider value={roomInstance}>
      
        <RoomAudioRenderer />



             
    </RoomContext.Provider>
  );
}