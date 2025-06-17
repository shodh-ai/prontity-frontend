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
   // Destructure the new prop
}: LiveKitSessionProps) {
  console.log('[LiveKitSession] Component rendering. Props received:', { roomName, userName });
  // State for UI elements that might be controlled by React state
  const [agentUpdatableTextState, setAgentUpdatableTextState] = useState("Initial text here. Agent can change me!");
  const [isAgentElementVisible, setIsAgentElementVisible] = useState(true);

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

    const handleConnected = () => {
      if (!mounted) return;
      console.log(`[LiveKitSession] Successfully connected to LiveKit room: ${roomInstance.name}`);
      setIsLoading(false);
      setConnectionError(null);

      if (agentServiceClientRef.current) {
        console.log('[LiveKitSession] RPC client already exists on connect, skipping setup.');
      } else if (roomInstance.localParticipant) {
        const AGENT_PARTICIPANT_IDENTITY = 'rox-custom-llm-agent';
        console.log(`[LiveKitSession] Setting up RPC with agent: ${AGENT_PARTICIPANT_IDENTITY}`);
        const livekitRpcAdapter = new LiveKitRpcAdapter(
            roomInstance.localParticipant,
            AGENT_PARTICIPANT_IDENTITY
        );
        agentServiceClientRef.current = new AgentInteractionClientImpl(livekitRpcAdapter);
        console.log('[LiveKitSession] LiveKit RPC client initialized.');
      } else {
        console.warn('[LiveKitSession] Local participant not available on connect, cannot set up RPC client.');
      }

      if (onRoomCreated) {
        onRoomCreated(roomInstance);
      }

      if (!hideAudio) {
        roomInstance.localParticipant?.setMicrophoneEnabled(true)
          .then(() => {
            if (mounted) {
              console.log("[LiveKitSession] Microphone enabled post-connection.");
              setAudioEnabled(true);
              setAudioInitialized(true);
            }
          })
          .catch(e => console.error('[LiveKitSession] Failed to enable microphone post-connection:', e));
      } else {
        if (mounted) setAudioInitialized(true);
      }

      console.log(`[LiveKitSession] Initial participants in room: ${roomInstance.numParticipants + 1}`);

      // The /api/agent call was removed as agent interaction is now handled via LiveKit RPC.
    };

    const handleDisconnected = () => {
      if (!mounted) return;
      console.log('[LiveKitSession] Disconnected from LiveKit room.');
      setToken(''); // Clear token on disconnect
      setIsLoading(false); // Stop loading if it was in progress
      // setConnectionError("Disconnected from session."); // Optional: inform user
      agentServiceClientRef.current = null;
      setAudioEnabled(false);
      setAudioInitialized(false); // Reset audio state
    };

    const onParticipantConnected = (participant: RemoteParticipant) => {
      console.log(`[LiveKitSession] Participant connected: ${participant.identity}`);
      console.log(`[LiveKitSession] Total participants in room: ${roomInstance.numParticipants + 1}`);
    };

    const onParticipantDisconnected = (participant: RemoteParticipant) => {
      console.log(`[LiveKitSession] Participant disconnected: ${participant.identity}`);
      console.log(`[LiveKitSession] Total participants in room: ${roomInstance.numParticipants + 1}`);
    };

    roomInstance.on(RoomEvent.Connected, handleConnected);
    roomInstance.on(RoomEvent.Disconnected, handleDisconnected);
    roomInstance.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    roomInstance.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);

    // Initial check in case already connected (e.g. hot reload preserves room state)
    if (roomInstance.state === ConnectionState.Connected) {
        handleConnected();
    }

    return () => {
      mounted = false;
      roomInstance.off(RoomEvent.Connected, handleConnected);
      roomInstance.off(RoomEvent.Disconnected, handleDisconnected);
      roomInstance.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      roomInstance.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      // Do not disconnect here if we want the room to persist across re-renders
    };
  }, [roomInstance, hideAudio, aiAssistantEnabled, onRoomCreated, userName]); // userName for agent call


  useEffect(() => {
    const handlePerformUIAction = async (
      data: RpcInvocationData // Data object from LiveKit, includes payload
    ): Promise<string> => { // LiveKit RPC handler must return Promise<string>
      console.log('[LiveKitSession] B2F RPC (handlePerformUIAction) invoked by agent.');
      
      // Import ReactUIActions if not already imported
      try {
        // Create props object for ReactUIActions
        const reactUIActionsProps = {
          textStateUpdaters: {
            'agentUpdatableText': setAgentUpdatableTextState,
          },
          visibilityStateUpdaters: {
            'agentToggleVisibilityElement': setIsAgentElementVisible,
          },
          timerControlUpdaters: {
            'speakingTaskTimer': (action: 'start' | 'stop' | 'pause' | 'reset', options?: any) => {
              console.log(`[LiveKitSession] Timer action for 'speakingTaskTimer': ${action}`, options);
              setUiTimerState(prev => {
                const currentTimer = prev['speakingTaskTimer'] || { isRunning: false, isPaused: false, timeLeft: 0, totalDuration: 0, timerType: 'task' };
                switch (action) {
                  case 'start':
                    const duration = options?.durationSeconds || 60;
                    const timerType = options?.timerType || 'task';
                    return { ...prev, 'speakingTaskTimer': { isRunning: true, isPaused: false, timeLeft: duration, totalDuration: duration, timerType: timerType } };
                  case 'stop':
                    return { ...prev, 'speakingTaskTimer': { ...currentTimer, isRunning: false, isPaused: false } };
                  case 'pause':
                    const pauseState = options?.pause !== undefined ? options.pause : !currentTimer.isPaused;
                    return { ...prev, 'speakingTaskTimer': { ...currentTimer, isPaused: pauseState } };
                  case 'reset':
                    return { ...prev, 'speakingTaskTimer': { ...currentTimer, timeLeft: currentTimer.totalDuration, isRunning: false, isPaused: false } };
                  default: return prev;
                }
              });
            },
          },
          progressIndicatorUpdaters: {
            'drillProgressIndicator': (currentStep: number, totalSteps: number, message?: string) => 
              setUiProgressState(prev => ({ ...prev, 'drillProgressIndicator': { currentStep, totalSteps, message } })),
          },
          scoreUpdaters: {
            'drillScoreDisplay': (scoreText: string, progressPercentage?: number) => 
              setUiScoreState(prev => ({ ...prev, 'drillScoreDisplay': { scoreText, progressPercentage } })),
          },
          buttonPropertiesUpdaters: {
            'submitAnswerButton': (properties: any) => setUiButtonProperties(prev => ({ ...prev, 'submitAnswerButton': { ...(prev['submitAnswerButton'] || {}), ...properties }})),
            'startRecordingButton': (properties: any) => setUiButtonProperties(prev => ({ ...prev, 'startRecordingButton': { ...(prev['startRecordingButton'] || {}), ...properties }})),
            'submitSpeakingTaskButton': (properties: any) => setUiButtonProperties(prev => ({ ...prev, 'submitSpeakingTaskButton': { ...(prev['submitSpeakingTaskButton'] || {}), ...properties }})),
            'roxStartRecommendedTaskButton': (properties: any) => setUiButtonProperties(prev => ({ ...prev, 'roxStartRecommendedTaskButton': { ...(prev['roxStartRecommendedTaskButton'] || {}), ...properties }})),
          },
          buttonOptionsUpdaters: {
            'feedbackOptionsPanel': (buttons: any) => setUiButtonOptions(prev => ({ ...prev, 'feedbackOptionsPanel': buttons })),
            'p7NavigationPanel': (buttons: any) => setUiButtonOptions(prev => ({ ...prev, 'p7NavigationPanel': buttons })),
          },
          inputFieldClearers: {
            'drillAnswerInputText': () => {
              const input = document.getElementById('drillAnswerInputText') as HTMLInputElement | HTMLTextAreaElement;
              if (input) input.value = '';
            },
          },
          editorReadonlySectionsUpdaters: {
            'scaffoldingFullEssayEditor': (ranges: Array<{start: any, end: any, readOnly: boolean}>) => {
              console.log('[LiveKitSession] Setting editor readonly sections for scaffoldingFullEssayEditor:', { ranges });
              // Placeholder for actual editor integration. You might store `ranges` in a state if needed.
            },
          },
          audioCuePlayers: {
            'audio_player': (soundName: string) => {
              console.log('[LiveKitSession] Requesting to play audio cue:', soundName);
              setUiAudioCue(soundName); // Trigger useEffect to play the sound
            },
          },
          loadingIndicatorUpdaters: {
            'globalLoadingIndicator': (isLoading: boolean, message?: string) => 
              setUiLoadingIndicators(prev => ({ ...prev, 'globalLoadingIndicator': { isLoading, message } })),
          },
          logActions: true
        };
        
        // Use the imported handleReactUIAction function
        const { handleReactUIAction } = await import('@/components/ui/ReactUIActions');
        return await handleReactUIAction(data, reactUIActionsProps);
      } catch (error) {
        console.error('[LiveKitSession] Error using ReactUIActions:', error);
        
        // Fallback to legacy implementation
        const payloadString = data.payload as string | undefined; // Assume data.payload is string | undefined (base64 encoded)
        let requestId = "";
        try {
          if (!payloadString) {
            console.error('Agent PerformUIAction: No payload received.');
            const errResponse = ClientUIActionResponse.create({ success: false, message: "Error: No payload" });
            return uint8ArrayToBase64(ClientUIActionResponse.encode(errResponse).finish());
          }

          const decodedPayload = base64ToUint8Array(payloadString);
          const request = AgentToClientUIActionRequest.decode(decodedPayload);
          requestId = request.requestId; // Store for response

          console.log(`Agent PerformUIAction Request Received: `, request);

          let success = true;
          let message = "Action performed successfully.";

          // --- Execute the UI Action ---
          switch (request.actionType) {
            case ClientUIActionType.SHOW_ALERT:
              const alertMsg = request.parameters["message"] || "Agent alert!";
              alert(`Agent Alert: ${alertMsg}`); // Simple alert for now
              message = `Alert shown: ${alertMsg}`;
              break;

            case ClientUIActionType.UPDATE_TEXT_CONTENT:
              const newText = request.parameters["text"];
              if (request.targetElementId && newText !== undefined) {
                // React way: Update state
                if (request.targetElementId === "agentUpdatableText") { // Example mapping
                    setAgentUpdatableTextState(newText);
                    message = `Element '${request.targetElementId}' text updated (React state).`;
                } else {
                // Direct DOM manipulation (less ideal in React, but for generic elements):
                  const element = document.getElementById(request.targetElementId);
                  if (element) {
                    element.innerText = newText;
                    message = `Element '${request.targetElementId}' text updated.`;
                  } else {
                    success = false;
                    message = `Error: Element '${request.targetElementId}' not found.`;
                  }
                }
              } else {
                success = false;
                message = "Error: Missing targetElementId or text parameter for UPDATE_TEXT_CONTENT.";
              }
              break;

            case ClientUIActionType.TOGGLE_ELEMENT_VISIBILITY:
              if (request.targetElementId) {
                // React way:
                if (request.targetElementId === "agentToggleVisibilityElement") {
                    setIsAgentElementVisible(prev => !prev); // Simple toggle
                    message = `Element '${request.targetElementId}' visibility toggled (React state).`;
                } else {
                // Direct DOM manipulation:
                  const element = document.getElementById(request.targetElementId);
                  if (element) {
                    element.style.display = element.style.display === 'none' ? '' : 'none';
                    message = `Element '${request.targetElementId}' visibility toggled.`;
                  } else {
                    success = false;
                    message = `Error: Element '${request.targetElementId}' not found.`;
                  }
                }
              } else {
                success = false;
                message = "Error: Missing targetElementId for TOGGLE_ELEMENT_VISIBILITY.";
              }
              break;

            default:
              success = false;
              message = `Error: Unknown action_type '${request.actionType}'.`;
              console.warn(`Unknown agent UI action: ${request.actionType}`);
          }

          const response = ClientUIActionResponse.create({ requestId, success, message });
          return uint8ArrayToBase64(ClientUIActionResponse.encode(response).finish());

        } catch (innerError) {
          console.error('Error handling Agent PerformUIAction:', innerError);
          const errMessage = innerError instanceof Error ? innerError.message : String(innerError);
          const errResponse = ClientUIActionResponse.create({
            requestId,
            success: false,
            message: `Client error processing UI action: ${errMessage}`
          });
          return uint8ArrayToBase64(ClientUIActionResponse.encode(errResponse).finish());
        }
      }
    };

    // Register the handler when connected
    if (roomInstance && roomInstance.state === 'connected' && roomInstance.localParticipant) {
      const rpcMethodName = "rox.interaction.ClientSideUI/PerformUIAction"; // package.Service/Method
      try {
        roomInstance.localParticipant.registerRpcMethod(rpcMethodName, handlePerformUIAction);
        console.log(`Client RPC Handler registered for: ${rpcMethodName}`);
      } catch (e) {
        // It might throw if already registered on hot-reload, handle gracefully
        if (e instanceof RpcError && e.message.includes("already registered")) {
          console.warn(`RPC method ${rpcMethodName} already registered. This might be due to hot reload.`);
        } else {
          console.error("Failed to register client-side RPC handler 'PerformUIAction':", e);
        }
      }
    }

    // Cleanup (optional but good practice, though LiveKit might handle it on disconnect)
    return () => {
      // if (roomInstance && roomInstance.localParticipant) {
      //   try {
      //     roomInstance.localParticipant.unregisterRpcMethod("rox.interaction.ClientSideUI/PerformUIAction", handlePerformUIAction);
      //   } catch (e) { /* ignore */ }
      // }
    };
  }, [roomInstance, roomInstance.state, roomInstance.localParticipant]); // Add dependencies

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