'use client';

// Import TTS highlighting styles
import '@/styles/tts-highlight.css';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import { Editor } from '@tiptap/react';
import { debounce } from 'lodash';

// Import the HighlightExtension and Highlight interface
import { HighlightExtension } from '@/components/TiptapEditor/HighlightExtension';
import { Highlight as HighlightType } from '@/components/TiptapEditor/highlightInterface';

// Import our reusable components
import TiptapEditor, { TiptapEditorHandle } from '@/components/TiptapEditor';
import EditorToolbar from '@/components/EditorToolbar';

import NextTaskButton from '@/components/NextTaskButton';
// Import our Socket.IO hook
import { useSocketIO } from '@/hooks/useSocketIO';

// Import LiveKit components and types
import { Room, RoomEvent, RemoteParticipant, DataPacket_Kind, LocalParticipant, RpcError, RpcInvocationData } from 'livekit-client';
import LiveKitSession, { LiveKitRpcAdapter } from '@/components/LiveKitSession';
import { getTokenEndpointUrl, tokenServiceConfig } from '@/config/services';
import { ReactUIActions, ReactUIActionsProps, ReactUIActionType, handleReactUIAction } from '@/components/ui/ReactUIActions';

// Import proto message types
import {
  FrontendButtonClickRequest,
  AgentResponse,
  AgentToClientUIActionRequest,
  ClientUIActionResponse,
  ClientUIActionType,
} from '@/generated/protos/interaction';

// Helper functions for Base64
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

// Types for messages
interface TextUpdateMessage {
  type: 'text_update';
  content: string;
  timestamp: number;
}

// Interface for writing prompt data
interface WritingPrompt {
  id: string;
  topicName: string;
  question: string;
  level: string;
  type: 'independent' | 'integrated';
  readingPassage?: string;
  lectureAudioUrl?: string;
}

export default function WritingPage() {
  // State for word count
  const [wordCount, setWordCount] = useState(0);
  
  // State for AI suggestions/highlights
  const [aiSuggestions, setAiSuggestions] = useState<HighlightType[]>([]);
  
  // State for active highlight ID
  const [activeHighlightId, setActiveHighlightId] = useState<string | number | null>(null);
  
  // State for TTS
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  
  // State for editor content (for debouncing)
  const [editorContent, setEditorContent] = useState('');
  
  // State for the writing prompt
  const [prompt, setPrompt] = useState<WritingPrompt | null>(null);
  
  // State for submission status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  // State for timer
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState(false);
  
  // LiveKit connection state
  const [token, setToken] = useState<string>('');
  const [room, setRoom] = useState<Room | null>(null);
  const [isLiveKitConnected, setIsLiveKitConnected] = useState(false);
  const liveKitRpcAdapterRef = useRef<LiveKitRpcAdapter | null>(null);
  
  // Navigation state for NAVIGATE_TO_PAGE action
  const [currentPage, setCurrentPage] = useState("writingpractice");
  const [pageData, setPageData] = useState<any>(null);
  
  // Navigation handler for NAVIGATE_TO_PAGE action
  const handleNavigation = (pageName: string, data?: any) => {
    console.log(`[WritingPractice] Navigation to page '${pageName}' requested with data:`, data);
    
    // Update local state for display purposes
    setCurrentPage(pageName);
    setPageData(data);
    
    // Perform actual navigation using window.location
    setTimeout(() => {
      // Check if the page exists before navigating
      const validPages = ['writingpractice', 'dashboard', 'rox_copy', 'profile', 'settings'];
      
      if (validPages.includes(pageName)) {
        // For data passing, you could use localStorage if needed
        if (data) {
          localStorage.setItem(`nav_data_${pageName}`, JSON.stringify(data));
        }
        
        // Navigate to the new page
        window.location.href = `/${pageName}`;
      } else {
        console.warn(`[WritingPractice] Navigation to unknown page '${pageName}' was requested`);
      }
    }, 500); // Short delay to show the navigation is happening
  };
  
  // Get search parameters for flow navigation
  const searchParams = useSearchParams();
  const flowPosition = parseInt(searchParams?.get('flowPosition') || '0', 10);
  const totalTasks = parseInt(searchParams?.get('totalTasks') || '0', 10);
  const taskId = searchParams?.get('taskId');
  const topicId = searchParams?.get('topicId');
  
  // Router for navigation
  const router = useRouter();
  
  // Ref for current editor content to avoid stale closures in socket handlers
  const editorContentRef = useRef('');
  
  // Last sent content for avoiding duplicate sends
  const lastSentContentRef = useRef('');
  
  // Use our Socket.IO hook for real-time communication
  const { socket, isConnected, sendMessage, aiSuggestion, clientId, error } = useSocketIO();
  
  // LiveKit error state
  const [liveKitError, setLiveKitError] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  
  // Room name for LiveKit - must match the agent's room name
  const roomName = 'Roxpage'; // Same room name used in rox_copy and the agent
  const userName = 'TestUser'; // Same user name used in rox_copy
  

  // Function to send text updates to the server
  const sendTextUpdate = useCallback((content: string) => {
    if (isConnected && content !== lastSentContentRef.current) {
      const message: TextUpdateMessage = {
        type: 'text_update',
        content,
        timestamp: Date.now()
      };
      
      sendMessage(message);
      lastSentContentRef.current = content; // Update last sent content reference
    } else if (!isConnected) {
      console.warn('Failed to send text update - will retry when connection is established.');
    }
  }, [isConnected, sendMessage]);

  // Create a debounced version of the send function to avoid too many updates
  const debouncedSendTextUpdate = useMemo(
    () => debounce(sendTextUpdate, 1000, { maxWait: 5000 }),
    [sendTextUpdate]
  );
  
  // Handle AI suggestions from Socket.IO
  useEffect(() => {
    if (aiSuggestion) {
      try {
        // Parse the AI suggestion string to get the suggestions array
        const suggestionsData = JSON.parse(aiSuggestion);
        
        // Convert server suggestions to our HighlightType format
        const highlights: HighlightType[] = Array.isArray(suggestionsData) ?
          suggestionsData.map((suggestion: any) => ({
            id: suggestion.id,
            start: suggestion.start,
            end: suggestion.end,
            type: suggestion.type,
            message: suggestion.message
          })) : [];
        
        setAiSuggestions(highlights);
      } catch (e) {
        console.error('Error parsing AI suggestions:', e);
      }
    }
  }, [aiSuggestion]);
  
  // When connection is established, send current content
  useEffect(() => {
    if (isConnected && editorContentRef.current && editorContentRef.current !== lastSentContentRef.current) {
      sendTextUpdate(editorContentRef.current);
    }
  }, [isConnected, sendTextUpdate]);
  
  // Reference to the editor for imperative actions if needed
  const editorRef = useRef<TiptapEditorHandle>(null);
  
  // Define the extensions we want to use
  const extensions = useMemo(() => [
    StarterKit,
    Highlight.configure({ multicolor: true }),
    TextStyle,
    Color,
    Placeholder.configure({
      placeholder: 'Start typing here...'
    }),
    // Add the HighlightExtension
    HighlightExtension
  ], []);

  // Effect to load the writing prompt from URL parameters or API
  useEffect(() => {
    // Function to fetch prompt from backend API or LiveKit agent
    const fetchPrompt = async (promptId: string) => {
      try {
        // For demo purposes, we're creating a mock prompt
        // In a real implementation, you would fetch from your API
        // or use the LiveKit RPC to request it from the agent
        
        // Example RPC call to agent (commented out - implement based on your RPC setup)
        /*
        if (liveKitRpcAdapterRef.current) {
          const response = await liveKitRpcAdapterRef.current.callRemoteMethod(
            'rox.interaction.Agent/ProcessInteraction',
            {
              current_context: { 
                user_id: 'student_123',
                task_stage: 'WRITING_TEST_LOAD_PROMPT', 
                current_page: 'P3_WritingTest', 
                prompt_id: promptId 
              },
              session_id: sessionId, // Get from auth or generate
              chat_history: []
            }
          );
          // Process response to get prompt data
        }
        */
        
        // Mock data for now
        const isIntegrated = promptId.includes('INT');
        const mockPrompt: WritingPrompt = {
          id: promptId,
          topicName: isIntegrated ? 'Academic Integration Task' : 'Independent Opinion Task',
          type: isIntegrated ? 'integrated' : 'independent',
          question: isIntegrated
            ? 'Summarize the points made in the lecture, being sure to explain how they challenge specific points made in the reading passage.'
            : 'Do you agree or disagree with the following statement? Technology has made children less creative than they were in the past. Use specific reasons and examples to support your answer.',
          level: 'TOEFL',
        };
        
        // Add reading passage and lecture for integrated tasks
        if (isIntegrated) {
          mockPrompt.readingPassage = 'Many scientists believe that globalization has benefited numerous plant and animal species around the world. The increased trade of plants and animals has allowed species to expand into territories where they previously did not exist, increasing biodiversity in those regions. Additionally, the increasing awareness of endangered species through global communications has led to international conservation efforts, which has helped save many species from extinction. Lastly, globalization has allowed scientists from around the world to collaborate on research projects, leading to better understanding of the natural world and more effective conservation strategies.';
          mockPrompt.lectureAudioUrl = '/sample-lecture.mp3'; // This would be a real URL in production
        }
        
        setPrompt(mockPrompt);
        
        // Set up a timer for the writing task
        // Independent: 30 minutes, Integrated: 20 minutes
        const timeLimit = isIntegrated ? 20 * 60 : 30 * 60; // in seconds
        setTimeRemaining(timeLimit);
        setTimerActive(true);
        
      } catch (error) {
        console.error('Error fetching writing prompt:', error);
      }
    };
    
    // Check if we have topic and task ID from flow navigation
    if (topicId && taskId) {
      console.log(`Loading writing task from flow: Topic ID ${topicId}, Task ID ${taskId}`);
      fetchPrompt(taskId);
      
      if (flowPosition !== null && totalTasks > 0) {
        console.log(`This is task ${flowPosition + 1} of ${totalTasks} in your learning flow`);
      }
      
      return;
    }
    
    // If no flow parameters, try to load prompt data from localStorage or use default
    const savedPromptId = localStorage.getItem('writingPromptId');
    if (savedPromptId) {
      fetchPrompt(savedPromptId);
    } else {
      // Use a default prompt ID
      fetchPrompt('WRT_IND_PROMPT002');
    }
    
  }, [topicId, taskId, flowPosition, totalTasks]);
  
  // Timer effect
  useEffect(() => {
    if (!timerActive || timeRemaining === null) return;
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timerActive, timeRemaining]);

  // Handle editor updates
  const handleEditorUpdate = useCallback(({ editor }: { editor: Editor }) => {
    // Update word count
    const text = editor.getText();
    setWordCount(text.split(/\s+/).filter(Boolean).length);
    
    // Only process if there is actual text content
    if (text.trim().length > 0) {
      // Get HTML content from the editor
      const content = editor.getHTML();
      
      // Update content state and refs
      setEditorContent(content);
      editorContentRef.current = content;
      
      // Send content update to server (debounced)
      debouncedSendTextUpdate(content);
    }
  }, [debouncedSendTextUpdate]);
  
  // Handle click on a highlight
  const handleHighlightClick = useCallback((id: string | number) => {
    console.log('WritingPage: handleHighlightClick called with ID:', id);
    setActiveHighlightId(id); // Set this highlight as active
    
    // Use our enhanced TTS component to both speak and highlight
    // if (!isSpeaking) {
    //   // tts.speakSuggestionById(id);
    // } else {
    //   // If we're already speaking, just stop and restart with this suggestion
    //   // tts.stopSpeaking();
    //   // setTimeout(() => tts.speakSuggestionById(id), 100);
    // }
  }, [isSpeaking]);
  
  // Define state updaters for UI actions
  const [transcriptText, setTranscriptText] = useState<string>("");
  const [remarksData, setRemarksData] = useState<any[]>([]);
  const [displayedText, setDisplayedText] = useState<string>("");
  const [scoreText, setScoreText] = useState<string>('Pending Evaluation');
  const [progressPercentage, setProgressPercentage] = useState<number | null>(null);
  
  // New UI action states
  const [buttonProperties, setButtonProperties] = useState<{[buttonId: string]: {
    label?: string;
    disabled?: boolean;
    taskData?: any;
    styleClass?: string;
  }}>({});
  const [buttonOptions, setButtonOptions] = useState<{[panelId: string]: Array<{label: string, actionContextUpdate: any}>}>({});
  const [isLoading, setIsLoading] = useState<{[indicatorId: string]: {isLoading: boolean, message?: string}}>({});
  
  // Text state updaters map for ReactUIActions
  const textStateUpdaters = useMemo(() => ({
    writingPromptDisplay: (text: string) => {
      console.log('Updating writing prompt:', text);
      // Update display or store the prompt text
      setDisplayedText(text);
    },
    feedbackContent: (text: string) => {
      console.log('Updating feedback content:', text);
      // Update any feedback content area
      setDisplayedText(text);
    },
  }), []);

  // Transcript updaters map for ReactUIActions
  const transcriptUpdaters = useMemo(() => ({
    liveTranscriptArea: (chunk: string, isFinal: boolean) => {
      console.log('Updating transcript:', { chunk, isFinal });
      if (isFinal) {
        setTranscriptText(chunk);
      } else {
        setTranscriptText(prev => prev + chunk);
      }
    },
  }), []);

  // Remarks list updaters map for ReactUIActions
  const remarksListUpdaters = useMemo(() => ({
    feedbackRemarks: (remarks: any[]) => {
      console.log('Updating remarks list:', remarks);
      setRemarksData(remarks);
    },
  }), []);
  
  // Score updaters map for ReactUIActions
  const scoreUpdaters = useMemo(() => ({
    drillScoreDisplay: (scoreText: string, progressPercentage?: number) => {
      console.log('Updating score display:', { scoreText, progressPercentage });
      setScoreText(scoreText);
      if (progressPercentage !== undefined) {
        setProgressPercentage(progressPercentage);
      }
    },
  }), []);
  
  // Button properties updaters for ReactUIActions
  const handleButtonPropertiesUpdate = useCallback((buttonId: string, properties: {
    label?: string;
    disabled?: boolean;
    taskData?: any;
    styleClass?: string;
  }) => {
    console.log('Updating button properties:', { buttonId, properties });
    setButtonProperties(prev => ({
      ...prev,
      [buttonId]: {
        ...prev[buttonId],
        ...properties
      }
    }));
  }, []);
  
  const buttonPropertiesUpdaters = useMemo(() => ({
    'submitAnswerButton': (properties: {label?: string; disabled?: boolean; taskData?: any; styleClass?: string}) => 
      handleButtonPropertiesUpdate('submitAnswerButton', properties),
    'startRecordingButton': (properties: {label?: string; disabled?: boolean; taskData?: any; styleClass?: string}) => 
      handleButtonPropertiesUpdate('startRecordingButton', properties),
    'submitSpeakingTaskButton': (properties: {label?: string; disabled?: boolean; taskData?: any; styleClass?: string}) => 
      handleButtonPropertiesUpdate('submitSpeakingTaskButton', properties),
    'roxStartRecommendedTaskButton': (properties: {label?: string; disabled?: boolean; taskData?: any; styleClass?: string}) => 
      handleButtonPropertiesUpdate('roxStartRecommendedTaskButton', properties),
  }), [handleButtonPropertiesUpdate]);
  
  // Button options updaters for ReactUIActions
  const handleButtonOptionsUpdate = useCallback((panelId: string, buttons: Array<{label: string, actionContextUpdate: any}>) => {
    console.log('Updating button options:', { panelId, buttons });
    setButtonOptions(prev => ({
      ...prev,
      [panelId]: buttons
    }));
  }, []);
  
  const buttonOptionsUpdaters = useMemo(() => ({
    'feedbackOptionsPanel': (buttons: Array<{label: string, actionContextUpdate: any}>) => handleButtonOptionsUpdate('feedbackOptionsPanel', buttons),
    'p7NavigationPanel': (buttons: Array<{label: string, actionContextUpdate: any}>) => handleButtonOptionsUpdate('p7NavigationPanel', buttons),
  }), [handleButtonOptionsUpdate]);
  
  // Input field clearers for ReactUIActions
  const handleInputFieldClear = useCallback((inputId: string) => {
    console.log('Clearing input field:', inputId);
    // This would normally directly set the value of the input to empty string
    // For complex components like editors, you'd need custom logic
    const input = document.getElementById(inputId) as HTMLInputElement | HTMLTextAreaElement;
    if (input) {
      input.value = '';
    }
  }, []);
  
  const inputFieldClearers = useMemo(() => ({
    'drillAnswerInputText': () => handleInputFieldClear('drillAnswerInputText'),
  }), [handleInputFieldClear]);
  
  // Editor readonly sections updaters for ReactUIActions
  const handleEditorReadonlySections = useCallback((editorId: string, ranges: Array<{start: any, end: any, readOnly: boolean}>) => {
    console.log('Setting editor readonly sections:', { editorId, ranges });
    // This would integrate with your specific editor implementation
    // For Tiptap, you'd need to implement an extension that handles readonly ranges
  }, []);
  
  const editorReadonlySectionsUpdaters = useMemo(() => ({
    'scaffoldingFullEssayEditor': (ranges: Array<{start: any, end: any, readOnly: boolean}>) => handleEditorReadonlySections('scaffoldingFullEssayEditor', ranges),
  }), [handleEditorReadonlySections]);
  
  // Audio cue players for ReactUIActions have been removed
  
  // Loading indicator updaters for ReactUIActions
  const handleLoadingIndicator = useCallback((indicatorId: string, isLoading: boolean, message?: string) => {
    console.log('Showing loading indicator:', { indicatorId, isLoading, message });
    setIsLoading(prev => ({
      ...prev,
      [indicatorId]: { isLoading, message }
    }));
  }, []);
  
  const loadingIndicatorUpdaters = useMemo(() => ({
    'globalLoadingIndicator': (isLoading: boolean, message?: string) => handleLoadingIndicator('globalLoadingIndicator', isLoading, message),
  }), [handleLoadingIndicator]);

  // ReactUIActions props
  const reactUIActionsProps = useMemo(() => ({
    textStateUpdaters,
    transcriptUpdaters,
    remarksListUpdaters,
    scoreUpdaters,
    navigationUpdaters: {
      // Handle navigation to other pages
      mainNavigation: handleNavigation
    },
    // New UI action updaters
    buttonPropertiesUpdaters,
    buttonOptionsUpdaters,
    inputFieldClearers,
    editorReadonlySectionsUpdaters,
    loadingIndicatorUpdaters,
    logActions: true
  }), [textStateUpdaters, transcriptUpdaters, remarksListUpdaters, scoreUpdaters, handleNavigation, 
      buttonPropertiesUpdaters, buttonOptionsUpdaters, inputFieldClearers, editorReadonlySectionsUpdaters, 
      loadingIndicatorUpdaters]);
  
  // Handle AI-driven actions through RPC
  const handlePerformUIAction = async (rpcInvocationData: RpcInvocationData): Promise<string> => {
    console.log('[WritingPractice] RPC (handlePerformUIAction) invoked by agent:', rpcInvocationData);
    
    try {
      // Process the action using ReactUIActions handler
      return await handleReactUIAction(rpcInvocationData, reactUIActionsProps);
    } catch (error) {
      console.error('[WritingPractice] Error handling Agent UI action:', error);
      const errMessage = error instanceof Error ? error.message : String(error);
      const errResponse = ClientUIActionResponse.create({ 
        requestId: rpcInvocationData.requestId || "", 
        success: false, 
        message: `Client error processing UI action: ${errMessage}` 
      });
      return uint8ArrayToBase64(ClientUIActionResponse.encode(errResponse).finish());
    }
  };
  
  // Connect to LiveKit room
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const tokenUrl = getTokenEndpointUrl(roomName, userName);
        console.log('[writingmodelling/page.tsx] Attempting to fetch token from URL:', tokenUrl);
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
        setLiveKitError((err as Error).message);
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
        setIsLiveKitConnected(true);
        setRoom(newRoomInstance);
        roomRef.current = newRoomInstance;

        // Setup RPC client once connected
        if (newRoomInstance.localParticipant) {
          // Initialize RPC adapter with a fallback identity first
          const fallbackAgentIdentity = "rox-custom-llm-agent";
          liveKitRpcAdapterRef.current = new LiveKitRpcAdapter(
            newRoomInstance.localParticipant, 
            fallbackAgentIdentity
          );
          console.log('LiveKit RPC adapter initialized with fallback identity. Will update when agent is detected.');

          const localP = newRoomInstance.localParticipant;

          // Register B2F RPC Handler
          const b2f_rpcMethodName = "rox.interaction.ClientSideUI/PerformUIAction";
          console.log(`[WritingPage] Attempting to register RPC handler for: ${b2f_rpcMethodName}`);
          try {
            localP.registerRpcMethod(b2f_rpcMethodName, handlePerformUIAction);
            console.log(`[WritingPage] RPC Handler registered successfully for: ${b2f_rpcMethodName}`);
          } catch (e) {
            if (e instanceof RpcError && e.message.includes("already registered")) {
              console.warn(`[WritingPage] RPC method ${b2f_rpcMethodName} already registered (this might be due to hot reload).`);
            } else {
              console.error("[WritingPage] Failed to register RPC handler 'PerformUIAction':", e);
            }
          }
          
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
                console.log('LiveKit RPC adapter updated with detected agent identity.');
              }
            }
          });
          
          // Check for existing remote participants
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
                console.log('LiveKit RPC adapter updated with existing agent identity.');
              }
            } catch (err) {
              console.warn('Error checking existing participants:', err);
            }
          }
        }
      });

      newRoomInstance.on(RoomEvent.Disconnected, () => {
        console.log('Disconnected from LiveKit room');
        setIsLiveKitConnected(false);
        setRoom(null);
        if (roomRef.current === newRoomInstance) {
          roomRef.current = null;
        }
      });

      try {
        await newRoomInstance.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL || '', token, {
          autoSubscribe: true,
        });
      } catch (err) {
        setLiveKitError(`Failed to connect: ${(err as Error).message}`);
        setRoom(null);
        roomRef.current = null;
      }
    };

    if (token && !roomRef.current) {
      connect();
    }

    return () => {
      console.log('Cleaning up LiveKit room connection');
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, [token, roomName]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-4 text-center">TOEFL Writing Practice</h1>
      
      {/* Timer display */}
      {timeRemaining !== null && (
        <div className="text-center mb-4">
          <div className="inline-block bg-gray-100 px-4 py-2 rounded-lg font-mono text-lg">
            Time Remaining: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
          </div>
        </div>
      )}
      
      {/* Display writing prompt if available */}
      {prompt && (
        <div className="mb-6 bg-white shadow rounded-lg p-4 border-l-4 border-blue-500">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                {prompt.level}
              </span>
              <span className="inline-block bg-gray-100 text-gray-800 text-xs font-semibold px-2.5 py-0.5 rounded ml-2">
                {prompt.type === 'integrated' ? 'Integrated Writing Task' : 'Independent Writing Task'}
              </span>
              <span className="inline-block bg-gray-100 text-gray-800 text-xs font-semibold px-2.5 py-0.5 rounded ml-2">
                Topic: {prompt.topicName}
              </span>
            </div>
          </div>
          
          {/* Reading passage for integrated tasks */}
          {prompt.type === 'integrated' && prompt.readingPassage && (
            <div id="writingTestReadingPassage" className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
              <h3 className="text-md font-medium mb-2">Reading Passage:</h3>
              <div className="text-gray-700 text-sm">{prompt.readingPassage}</div>
            </div>
          )}
          
          {/* Audio player for integrated tasks */}
          {prompt.type === 'integrated' && prompt.lectureAudioUrl && (
            <div id="writingTestLectureAudio" className="mb-4">
              <h3 className="text-md font-medium mb-2">Lecture Audio:</h3>
              <audio controls className="w-full">
                <source src={prompt.lectureAudioUrl} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
            </div>
          )}
          
          <h2 id="writingTestPrompt" className="text-lg font-medium mb-2">Writing Task:</h2>
          <p className="text-gray-700">{prompt.question}</p>
        </div>
      )}
      
      <div className="flex justify-between items-center mb-4">
        <div className="connection-status">
          <span className="mr-2">Connection Status:</span>
          <span className={`px-2 py-1 rounded text-sm font-medium ${
            isConnected 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-800'
          }`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="text-sm text-gray-600">
          Word count: {wordCount}
        </div>
      </div>

      {/* Display area for transcript from agent */}
      <div id="liveTranscriptArea" className="mt-4 p-3 bg-gray-100 rounded-lg text-gray-800">
        {transcriptText ? (
          <div>
            <h3 className="text-sm font-semibold mb-1">Live Transcript</h3>
            <p>{transcriptText}</p>
          </div>
        ) : null}
      </div>
      
      {/* Display area for feedback content from agent */}
      <div id="feedbackContent" className="mt-4 p-3 bg-blue-50 rounded-lg text-gray-800">
        {displayedText ? (
          <div>
            <h3 className="text-sm font-semibold mb-1">Feedback</h3>
            <p>{displayedText}</p>
          </div>
        ) : null}
      </div>
      
      {/* Display area for remarks list from agent */}
      <div id="feedbackRemarks" className="mt-4 mb-4">
        {remarksData.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold mb-2">Detailed Remarks</h3>
            <div className="space-y-2">
              {remarksData.map((remark) => (
                <div key={remark.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <h4 className="font-medium">{remark.title}</h4>
                  <p className="text-sm text-gray-700 mt-1">{remark.details}</p>
                  {remark.correction_suggestion && (
                    <p className="text-sm text-green-700 mt-1 italic">
                      Suggestion: {remark.correction_suggestion}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      
      {/* Score display element */}
      <div id="drillScoreDisplay" className="mt-4 mb-4 p-4 bg-white border border-blue-200 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-blue-800">Essay Score</h3>
          <div className="text-xl font-bold text-blue-600">{scoreText || "Not scored yet"}</div>
        </div>
        {progressPercentage !== null && (
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-500 mt-1 text-right">{progressPercentage}% complete</div>
          </div>
        )}
      </div>
      
      <div className="editor-wrapper border border-gray-300 rounded-lg p-4 bg-white">
        {/* The editor toolbar component */}
        <EditorToolbar 
          editor={editorRef.current?.editor ?? null} 
          className="mb-4" 
        />
        
        {/* Our reusable TiptapEditor component */}
        <TiptapEditor
          ref={editorRef}
          initialContent="<p>Start writing your response here...</p>"
          isEditable={true}
          extensions={extensions}
          onUpdate={handleEditorUpdate}
          onHighlightClick={handleHighlightClick}
          highlightData={aiSuggestions}
          activeHighlightId={activeHighlightId}
          className="prose max-w-none min-h-[500px] focus:outline-none"
        />
      </div>
      
      <div className="mt-4 flex justify-between items-start">
        <div className="w-2/3">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-medium">AI Suggestions</h3>
            {aiSuggestions.length > 0 && (
              <button 
                className={`px-3 py-1 rounded text-sm ${isSpeaking 
                  ? 'bg-gray-400 text-white cursor-not-allowed' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white transition-colors'}`}
                // onClick={tts.speakAllSuggestions} // TTS functionality removed
                disabled={isSpeaking || aiSuggestions.length === 0}
                title={isSpeaking ? 'Speaking...' : 'Listen to explanations'}
              >
                {isSpeaking ? 'Speaking...' : 'Explain Suggestions'}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {aiSuggestions.map((highlight) => (
              <div 
                key={highlight.id}
                id={`suggestion-${highlight.id}`} // Important: consistent ID format
                className={`p-2 border rounded-md cursor-pointer transition-colors ${
                  activeHighlightId === highlight.id 
                    ? 'bg-yellow-100 border-yellow-400' 
                    : 'bg-white border-gray-200'
                }`}
                onClick={() => handleHighlightClick(highlight.id)}
              >
                <div className="font-medium text-sm capitalize">{highlight.type}</div>
                <div className="text-sm">{highlight.message}</div>
              </div>
            ))}
            {aiSuggestions.length === 0 && isConnected && (
              <div className="text-gray-500 italic">AI suggestions will appear here after you start typing...</div>
            )}
            {aiSuggestions.length === 0 && !isConnected && (
              <div className="text-gray-500 italic">Connect to the server to receive AI suggestions...</div>
            )}
          </div>
        </div>
        <div className="text-right text-gray-600">
          <div className="text-xs text-gray-400 mb-2">
            {isConnected ? 'Changes are saved automatically' : 'Changes will be saved when connected'}
          </div>
          {isSpeaking && (
            <button 
              className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              // onClick={tts.stopSpeaking} // TTS functionality removed
              title="Stop speaking"
            >
              Stop Speaking
            </button>
          )}
        </div>
      </div>
      
      {/* Accessibility element for screen readers */}
      <div className="sr-only" aria-live="polite">
        {isSpeaking ? `Reading ${activeHighlightId ? 'suggestion ' + activeHighlightId : 'suggestions'} aloud` : 'Ready to read suggestions'}
      </div>
      
      {/* Just the Next Task Button without flow progress header */}
      {/* Submit Essay Section */}
      <div className="mt-8 mx-auto max-w-3xl">
        {!isSubmitted ? (
          <button
            id="submitWritingTaskButton"
            onClick={async () => {
              setIsSubmitting(true);
              try {
                // Get the essay content
                const essayText = editorRef.current?.editor?.getText() || '';
                const essayHtml = editorContentRef.current;
                
                // Validate essay length
                if (wordCount < 150) {
                  alert('Your essay is too short. Please write at least 150 words.');
                  setIsSubmitting(false);
                  return;
                }
                
                console.log('Submitting essay for AI analysis...');
                
                // In a real implementation, you would use LiveKit RPC to submit the essay to the agent
                /*
                if (liveKitRpcAdapterRef.current && prompt) {
                  const response = await liveKitRpcAdapterRef.current.callRemoteMethod(
                    'rox.interaction.Agent/ProcessInteraction',
                    {
                      submitted_text_content: essayText,
                      current_context: { 
                        user_id: 'student_123',
                        task_stage: 'WRITING_TEST_SUBMITTED', 
                        current_page: 'P3_WritingTest', 
                        prompt_id: prompt.id,
                        word_count: wordCount
                      },
                      session_id: sessionId, // Get from auth or generate
                      chat_history: []
                    }
                  );
                  // Process response
                }
                */
                
                // Save submission to localStorage for demo purposes
                localStorage.setItem('lastSubmittedEssay', essayText);
                localStorage.setItem('lastSubmittedEssayHtml', essayHtml || '');
                localStorage.setItem('lastSubmittedPromptId', prompt?.id || '');
                localStorage.setItem('submissionTimestamp', Date.now().toString());
                
                // Set as submitted
                setIsSubmitted(true);
                setIsSubmitting(false);
                
                // In a real app, you would handle the response from the agent here
                setTimeout(() => {
                  // Navigate to home or feedback page
                  router.push('/roxpage?message=Your essay has been submitted successfully! You will be notified when feedback is ready.');
                }, 1500);
                
              } catch (error) {
                console.error('Error submitting essay:', error);
                alert('There was an error submitting your essay. Please try again.');
                setIsSubmitting(false);
              }
            }}
            disabled={isSubmitting || wordCount < 50}
            className={`w-full py-3 rounded-lg font-medium text-white ${isSubmitting || wordCount < 50 ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 transition-colors'}`}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Essay for Feedback'}
          </button>
        ) : (
          <div id="writingTestStatusMessage" className="text-center p-4 bg-green-100 text-green-800 rounded-lg">
            <div id="writingTestProcessingSpinner" className="inline-block mr-2">
              <svg className="animate-spin h-5 w-5 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            Essay submitted successfully! Your feedback will be ready soon.
          </div>
        )}
      </div>

      {/* LiveKit integration for Agent connections */}
      {token && (
        <ReactUIActions {...reactUIActionsProps} />
      )}

      {/* UI Action Testing Elements Section */}
      <div className="mt-12 border-t-2 border-gray-200 pt-6">
        <h2 className="text-2xl font-bold mb-4">UI Action Testing Area</h2>
        
        {/* Buttons for SET_BUTTON_PROPERTIES, ENABLE_BUTTON, DISABLE_BUTTON actions */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Button Actions</h3>
          <div className="flex flex-wrap gap-3">
            <button 
              id="submitAnswerButton" 
              className={`px-4 py-2 rounded ${buttonProperties.submitAnswerButton?.styleClass || 'bg-blue-500 text-white'}`}
              disabled={buttonProperties.submitAnswerButton?.disabled}
              onClick={() => console.log('Answer submitted', buttonProperties.submitAnswerButton?.taskData)}
            >
              {buttonProperties.submitAnswerButton?.label || 'Submit Answer'}
            </button>
            
            <button 
              id="startRecordingButton" 
              className="px-4 py-2 bg-red-500 text-white rounded"
              disabled={buttonProperties.startRecordingButton?.disabled}
              onClick={() => console.log('Recording started')}
            >
              {buttonProperties.startRecordingButton?.label || 'Start Recording'}
            </button>
            
            <button 
              id="submitSpeakingTaskButton" 
              className="px-4 py-2 bg-green-500 text-white rounded"
              disabled={buttonProperties.submitSpeakingTaskButton?.disabled}
              onClick={() => console.log('Speaking task submitted')}
            >
              {buttonProperties.submitSpeakingTaskButton?.label || 'Submit Speaking Task'}
            </button>

            <button 
              id="roxStartRecommendedTaskButton" 
              className="px-4 py-2 bg-purple-500 text-white rounded"
              disabled={buttonProperties.roxStartRecommendedTaskButton?.disabled}
              onClick={() => console.log('Recommended task started')}
            >
              {buttonProperties.roxStartRecommendedTaskButton?.label || 'Start Recommended Task'}
            </button>
          </div>
        </div>
        
        {/* Panel for SHOW_BUTTON_OPTIONS action */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Button Options</h3>
          
          <div id="feedbackOptionsPanel" className="bg-gray-100 p-4 rounded-lg">
            <h4 className="text-md font-medium mb-2">Feedback Options Panel</h4>
            <div className="flex flex-wrap gap-2">
              {buttonOptions.feedbackOptionsPanel && buttonOptions.feedbackOptionsPanel.length > 0 ? (
                buttonOptions.feedbackOptionsPanel.map((option, index) => (
                  <button
                    key={index}
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    onClick={() => console.log('Option clicked:', option.actionContextUpdate)}
                  >
                    {option.label}
                  </button>
                ))
              ) : (
                <div className="text-gray-500">No options available. Use SHOW_BUTTON_OPTIONS action to display buttons here.</div>
              )}
            </div>
          </div>

          <div id="p7NavigationPanel" className="mt-3 bg-gray-100 p-4 rounded-lg">
            <h4 className="text-md font-medium mb-2">Navigation Panel</h4>
            <div className="flex flex-wrap gap-2">
              {buttonOptions.p7NavigationPanel && buttonOptions.p7NavigationPanel.length > 0 ? (
                buttonOptions.p7NavigationPanel.map((option, index) => (
                  <button
                    key={index}
                    className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                    onClick={() => console.log('Navigation option clicked:', option.actionContextUpdate)}
                  >
                    {option.label}
                  </button>
                ))
              ) : (
                <div className="text-gray-500">No navigation options available.</div>
              )}
            </div>
          </div>
        </div>
        
        {/* Input field for CLEAR_INPUT_FIELD action */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Input Field</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-grow">
              <label htmlFor="drillAnswerInputText" className="block text-sm font-medium text-gray-700 mb-1">
                Sample Answer Input (for CLEAR_INPUT_FIELD action)
              </label>
              <input 
                type="text" 
                id="drillAnswerInputText" 
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                placeholder="Type something here, then use CLEAR_INPUT_FIELD action"
                defaultValue="This text should be cleared with the CLEAR_INPUT_FIELD action"
              />
            </div>
            <button 
              className="px-4 py-2 bg-gray-500 text-white rounded"
              onClick={() => {
                const input = document.getElementById('drillAnswerInputText') as HTMLInputElement;
                if (input) input.value = 'Reset manually';
              }}
            >
              Reset Manually
            </button>
          </div>
        </div>

        {/* Editor for SET_EDITOR_READONLY_SECTIONS action */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Editor Readonly Sections</h3>
          <div className="border border-gray-300 rounded p-3 bg-white">
            <div id="scaffoldingFullEssayEditor" className="min-h-[100px]">
              <p>This editor area simulates the SET_EDITOR_READONLY_SECTIONS action.</p>
              <p>When readonly sections are applied, parts of this text would be non-editable.</p>
              <p>Currently this is just a placeholder - the actual readonly sections would need integration with your editor component.</p>
            </div>
          </div>
        </div>
        
        {/* Loading indicator for SHOW_LOADING_INDICATOR action */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Loading Indicator</h3>
          <p className="text-gray-600 mb-3">The loading indicator will be shown automatically when triggered by the agent.</p>
          
          {/* The actual loading indicator */}
          {isLoading.globalLoadingIndicator?.isLoading && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-lg flex flex-col items-center">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
                <p className="mt-4 text-gray-700">{isLoading.globalLoadingIndicator.message || 'Loading...'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}