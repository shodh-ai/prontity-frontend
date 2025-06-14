'use client';

import {
  RoomContext,
  RoomAudioRenderer
} from '@livekit/components-react';
import { Room, Track, RoomEvent, LocalParticipant, RemoteParticipant, RpcError, RpcInvocationData } from 'livekit-client'; // Import necessary types
import { useEffect, useState, useCallback, useRef } from 'react';
import AgentController from '@/components/AgentController';
import LiveKitSessionUI from '@/components/LiveKitSessionUI';
import InteractionControlsWithRpc from '@/components/ui/InteractionControlsWithRpc';
import { useDoubtHandler } from '@/components/DoubtHandlerProvider';
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
  AgentToClientUIActionRequest,
  ClientUIActionResponse,
  ClientUIActionType, // Import the enum
   // Import for the new payload type
} from '@/generated/protos/interaction'; // Adjust path if your generated file is elsewhere
import { FrontendButtonClickRequest } from '@/generated/protos/interaction'; // Import request message
import { createContext } from 'react';

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
  enableInteractionControls?: boolean;
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
  enableInteractionControls = false,
  onRoomCreated,
}: LiveKitSessionProps) {
  // State for UI elements that might be controlled by React state
  const [agentUpdatableText, setAgentUpdatableText] = useState<string>('This text can be updated by the agent via RPC call.');
  const [agentElementVisible, setAgentElementVisible] = useState<boolean>(true);

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
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [transcript, setTranscript] = useState('');
  
  // Get doubt handler context for interaction feedback
  let doubtHandlerContext: any;
  try {
    doubtHandlerContext = useDoubtHandler();
  } catch (error) {
    // DoubtHandlerProvider might not be in the component tree
    console.log('DoubtHandlerProvider not found in component tree');
  }

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
  
  // Handler for hand raise button via RPC
  const handleHandRaise = async (): Promise<void> => {
    if (!agentServiceClientRef.current) {
      console.error('Agent RPC service client not initialized. Are you connected to the room?');
      return;
    }
    
    try {
      setIsHandRaised(!isHandRaised);
      
      const request = FrontendButtonClickRequest.create({
        buttonId: "hand_raise_button",
        customData: JSON.stringify({
          action: "hand_raise",
          user: userName,
          timestamp: new Date().toISOString(),
          isRaised: !isHandRaised // Toggle state
        })
      });
      
      console.log('Sending hand raise RPC request to agent:', request);
      
      const response = await agentServiceClientRef.current.HandleFrontendButton(request);
      console.log('Hand raise RPC response from agent:', response);
    } catch (error) {
      console.error('Error calling hand raise RPC:', error);
      // Revert state if there was an error
      setIsHandRaised(isHandRaised);
    }
  };

  // Initialize speech recognition
  const initSpeechRecognition = () => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      // @ts-ignore - TypeScript doesn't have built-in types for webkit prefixed APIs
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript + ' ';
        }
        setTranscript(currentTranscript.trim());
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        stopSpeechRecognition();
        setIsPushToTalkActive(false);
      };
      
      recognition.onend = () => {
        setIsPushToTalkActive(false);
      };
      
      return recognition;
    }
    return null;
  };

  // Start speech recognition
  const startSpeechRecognition = () => {
    if (!recognitionRef.current) {
      recognitionRef.current = initSpeechRecognition();
    }
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        return true;
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        return false;
      }
    } else {
      console.error('Speech recognition is not supported in this browser');
      return false;
    }
  };

  // Stop speech recognition
  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors on unmount
        }
      }
    };
  }, []);

  // Handler for push to talk via RPC
  const handlePushToTalk = async (isActive: boolean): Promise<void> => {
    if (!agentServiceClientRef.current) {
      console.error('Agent RPC service client not initialized. Are you connected to the room?');
      return;
    }
    
    try {
      setIsPushToTalkActive(isActive);
      
      if (isActive) {
        // Starting push-to-talk - initialize speech recognition
        const started = startSpeechRecognition();
        if (!started) {
          // If speech recognition failed to start
          setIsPushToTalkActive(false);
          return;
        }

        // Send initial push-to-talk activation request
        const startRequest = FrontendButtonClickRequest.create({
          buttonId: "push_to_talk_button",
          customData: JSON.stringify({
            action: "push_to_talk_start",
            user: userName,
            timestamp: new Date().toISOString()
          })
        });
        
        console.log('Sending push-to-talk start RPC request to agent:', startRequest);
        
        const response = await agentServiceClientRef.current.HandleFrontendButton(startRequest);
        
      } else {
        // Ending push-to-talk - stop recording and send transcript
        stopSpeechRecognition();
        
        if (transcript.trim()) {
          const endRequest = FrontendButtonClickRequest.create({
            buttonId: "push_to_talk_end",
            customData: JSON.stringify({
              action: "push_to_talk_end",
              user: userName,
              timestamp: new Date().toISOString(),
              transcript: transcript.trim(),
              session_id: roomName // Using roomName as session ID
            })
          });
          
          console.log('Sending push-to-talk end RPC request with transcript to agent:', endRequest);
          
          const response = await agentServiceClientRef.current.HandleFrontendButton(endRequest);
          console.log('Push-to-talk transcript RPC response from agent:', response);
                console.log('Doubt UI action:', doubtResponse.ui_action);
                // Process UI action if needed (redirect, show dialog, etc.)
                if (doubtResponse.ui_action.action_type_str === 'REDIRECT_TO_PAGE' && 
                    doubtResponse.ui_action.parameters?.url) {
                  // Could use router.push here if you want to redirect
                  console.log('Should redirect to:', doubtResponse.ui_action.parameters.url);
                }
              }
            } catch (error) {
              console.error('Error processing doubt response payload:', error);
            }
          }
          
          // Clear transcript after sending
          setTranscript('');
        } else {
          console.log('No transcript to send');
        }
      }
      
    } catch (error) {
      console.error('Error calling push-to-talk RPC:', error);
      // Clean up and revert state if there was an error
      if (isActive) {
        stopSpeechRecognition();
      }
      setIsPushToTalkActive(false);
    }
  };

  // Define state for timer and progress indicators
  const [timerState, setTimerState] = useState<{
    isRunning: boolean;
    isPaused: boolean;
    timeLeft: number;
    totalDuration: number;
    timerType: string;
  }>({
    isRunning: false,
    isPaused: false,
    timeLeft: 0,
    totalDuration: 0,
    timerType: 'prep'
  });
  
  const [progressState, setProgressState] = useState<{
    currentStep: number;
    totalSteps: number;
    message?: string;
  }>({
    currentStep: 0,
    totalSteps: 10,
    message: ''
  });
  
  const [scoreState, setScoreState] = useState<{
    scoreText: string;
    progressPercentage?: number;
  }>({
    scoreText: '',
    progressPercentage: 0
  });
  
  // New UI action states
  const [buttonProperties, setButtonProperties] = useState<{[buttonId: string]: {
    label?: string;
    disabled?: boolean;
    taskData?: any;
    styleClass?: string;
  }}>({});
  const [buttonOptions, setButtonOptions] = useState<{[panelId: string]: Array<{label: string, actionContextUpdate: any}>}>({});
  const [isLoading, setIsLoading] = useState<{[indicatorId: string]: {isLoading: boolean, message?: string}}>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Handler functions for timers and progress indicators
  const handleTimerControl = (action: 'start' | 'stop' | 'pause' | 'reset', options?: any) => {
    console.log(`[LiveKitSession] Timer action: ${action}`, options);
    
    switch (action) {
      case 'start':
        const duration = options?.durationSeconds || 60;
        const timerType = options?.timerType || 'task';
        setTimerState({
          isRunning: true,
          isPaused: false,
          timeLeft: duration,
          totalDuration: duration,
          timerType: timerType
        });
        // In a real implementation, you would start a timer interval here
        break;
      case 'stop':
        setTimerState(prev => ({
          ...prev,
          isRunning: false,
          isPaused: false
        }));
        break;
      case 'pause':
        const pauseState = options?.pause !== undefined ? options.pause : !timerState.isPaused;
        setTimerState(prev => ({
          ...prev,
          isPaused: pauseState
        }));
        break;
      case 'reset':
        setTimerState(prev => ({
          ...prev,
          timeLeft: prev.totalDuration,
          isRunning: false,
          isPaused: false
        }));
        break;
    }
  };
  
  const handleProgressUpdate = (currentStep: number, totalSteps: number, message?: string) => {
    setProgressState({
      currentStep,
      totalSteps,
      message
    });
  };
  
  const handleScoreUpdate = (scoreText: string, progressPercentage?: number) => {
    setScoreState({
      scoreText,
      progressPercentage
    });
  };
  
  // New UI action handlers
  const handleButtonPropertiesUpdate = (buttonId: string, properties: {
    label?: string;
    disabled?: boolean;
    taskData?: any;
    styleClass?: string;
  }) => {
    console.log(`[LiveKitSession] Button properties update:`, { buttonId, properties });
    setButtonProperties(prev => ({
      ...prev,
      [buttonId]: {
        ...prev[buttonId],
        ...properties
      }
    }));
  };
  
  const handleButtonOptionsUpdate = (panelId: string, buttons: Array<{label: string, actionContextUpdate: any}>) => {
    console.log(`[LiveKitSession] Button options update:`, { panelId, buttons });
    setButtonOptions(prev => ({
      ...prev,
      [panelId]: buttons
    }));
  };
  
  const handleInputFieldClear = (inputId: string) => {
    console.log(`[LiveKitSession] Clearing input field:`, inputId);
    // This would normally directly set the value of the input to empty string
    // For complex components like editors, you'd need custom logic
    const input = document.getElementById(inputId) as HTMLInputElement | HTMLTextAreaElement;
    if (input) {
      input.value = '';
    }
  };
  
  const handleEditorReadonlySections = (editorId: string, ranges: Array<{start: any, end: any, readOnly: boolean}>) => {
    console.log(`[LiveKitSession] Setting editor readonly sections:`, { editorId, ranges });
    // This would integrate with your specific editor implementation
  };
  
  const handlePlayAudioCue = (soundName: string) => {
    console.log(`[LiveKitSession] Playing audio cue:`, soundName);
    // Map sound names to actual audio files
    const soundMap: {[key: string]: string} = {
      'correct_answer_ding': '/sounds/correct_answer_ding.mp3',
      'error_buzz': '/sounds/error_buzz.mp3',
      'notification_pop': '/sounds/notification_pop.mp3'
    };
    
    // Play the audio if it exists in our map
    if (soundMap[soundName]) {
      if (!audioRef.current) {
        audioRef.current = new Audio(soundMap[soundName]);
      } else {
        audioRef.current.src = soundMap[soundName];
      }
      audioRef.current.play().catch(err => console.error('Error playing audio:', err));
    }
  };
  
  const handleLoadingIndicator = (indicatorId: string, isLoading: boolean, message?: string) => {
    console.log(`[LiveKitSession] Updating loading indicator:`, { indicatorId, isLoading, message });
    setIsLoading(prev => ({
      ...prev,
      [indicatorId]: { isLoading, message }
    }));
  };

  useEffect(() => {
    const handlePerformUIAction = async (
      data: RpcInvocationData // Data object from LiveKit, includes payload
    ): Promise<string> => { // LiveKit RPC handler must return Promise<string>
      console.log('[LiveKitSession] B2F RPC (handlePerformUIAction) invoked by agent.');
      
      // Import ReactUIActions if not already imported
      try {
        // Create props object for ReactUIActions
        const reactUIActionsProps = {
          // Text content updaters
          textStateUpdaters: {
            'agentUpdatableText': setAgentUpdatableText,
          },
          // Visibility updaters
          visibilityStateUpdaters: {
            'agentToggleVisibilityElement': setAgentElementVisible,
          },
          // Timer control updaters
          timerControlUpdaters: {
            'speakingTaskTimer': handleTimerControl,
          },
          // Progress indicator updaters
          progressIndicatorUpdaters: {
            'drillProgressIndicator': handleProgressUpdate,
          },
          // Score updaters
          scoreUpdaters: {
            'drillScoreDisplay': handleScoreUpdate,
          },
          // New UI action handlers
          buttonPropertiesUpdaters: {
            'submitAnswerButton': (properties: any) => handleButtonPropertiesUpdate('submitAnswerButton', properties),
            'startRecordingButton': (properties: any) => handleButtonPropertiesUpdate('startRecordingButton', properties),
            'submitSpeakingTaskButton': (properties: any) => handleButtonPropertiesUpdate('submitSpeakingTaskButton', properties),
            'roxStartRecommendedTaskButton': (properties: any) => handleButtonPropertiesUpdate('roxStartRecommendedTaskButton', properties),
          },
          buttonOptionsUpdaters: {
            'feedbackOptionsPanel': (buttons: any) => handleButtonOptionsUpdate('feedbackOptionsPanel', buttons),
            'p7NavigationPanel': (buttons: any) => handleButtonOptionsUpdate('p7NavigationPanel', buttons),
          },
          inputFieldClearers: {
            'drillAnswerInputText': () => handleInputFieldClear('drillAnswerInputText'),
          },
          editorReadonlySectionsUpdaters: {
            'scaffoldingFullEssayEditor': (ranges: any) => handleEditorReadonlySections('scaffoldingFullEssayEditor', ranges),
          },
          audioCuePlayers: {
            'audio_player': (soundName: string) => handlePlayAudioCue(soundName),
          },
          loadingIndicatorUpdaters: {
            'globalLoadingIndicator': (isLoading: boolean, message?: string) => handleLoadingIndicator('globalLoadingIndicator', isLoading, message),
          },
          // Enable logging
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
                // React way using state:
                if (request.targetElementId === "agentUpdatableText") {
                    setAgentUpdatableText(newText);
                    message = `Element '${request.targetElementId}' text updated (React state).`;
                } else {
                  // Direct DOM update as fallback
                  const newText = request.parameters?.new_text || "(Empty text from agent)";
                  const element = document.getElementById(request.targetElementId);
                  if (element) {
                    element.textContent = newText;
                    message = `Text content set for '${request.targetElementId}' via DOM.`;
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
                // For visibility toggle, we handle it specially for React-managed components
                if (request.targetElementId === 'agentToggleVisibilityElement') {
                  setAgentElementVisible((prev: boolean) => !prev); // Toggle using state
                  message = `Visibility toggled for React-managed element '${request.targetElementId}'.`;
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
      <div className="livekit-session-wrapper">
        <LiveKitSessionUI
          token={token}
          pageType={pageType}
          sessionTitle={sessionTitle}
          questionText={questionText}
          userName={userName}
          audioEnabled={audioEnabled}
          videoEnabled={videoEnabled}
          toggleAudio={toggleAudio}
          toggleCamera={toggleCamera}
          handleLeave={handleLeave}
          hideAudio={hideAudio}
          hideVideo={hideVideo}
          showTimer={showTimer}
          customControls={customControls}
          onHandRaise={handleHandRaise}
          transcript={transcript}
          onPushToTalk={handlePushToTalk}
          room={roomInstance}
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

          {/* Test UI elements - remove in production */}
          {process.env.NODE_ENV === 'development' && (
            <>
              {/* Elements for Agent to Target */}
              <div style={{ border: '1px solid blue', padding: '10px', marginTop: '10px' }}>
                <h4>Agent Controllable UI</h4>
                <p id="agentUpdatableText">{agentUpdatableText}</p>
                <div id="agentToggleVisibilityElement" style={{ background: 'lightgreen', padding: '5px', display: agentElementVisible ? 'block' : 'none' }}>
                  Agent can toggle my visibility.
                </div>
                <button id="agentTargetButton">Agent might click me later</button>
              </div>

              <div style={{ padding: '10px', background: '#f0f0f0', marginTop: '10px', textAlign: 'center', border: '1px solid #ccc' }}>
                <h4>Agent RPC Test</h4>
                <button onClick={handleRpcButtonClick} className="figma-button" disabled={!agentServiceClientRef.current || roomInstance.state !== 'connected'}>
                  Trigger Agent RPC
                </button>
                <p style={{ marginTop: '5px', fontSize: 'small', color: '#333' }}>
                  Agent RPC Response: <span style={{ fontWeight: 'bold' }}>{rpcResponse || '(No response yet)'}</span>
                </p>
              </div>
            </>
          )}
        </LiveKitSessionUI>
      </div>
    </RoomContext.Provider>
  );
}