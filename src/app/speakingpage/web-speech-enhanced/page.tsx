'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import _ from 'lodash';
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import { debounce } from 'lodash';

// Import the TiptapEditor and necessary extensions
import TiptapEditor, { TiptapEditorHandle } from '@/components/TiptapEditor';
import { HighlightExtension } from '@/components/TiptapEditor/HighlightExtension';

// Import Socket.IO hook for AI suggestions
import { useSocketIO } from '@/hooks/useSocketIO';

// Define highlight interface that matches the component's expectations
interface HighlightType {
  id: string;
  content: string;    // Original content for our use
  from: number;       // For our internal use
  to: number;         // For our internal use
  type: string;       // Type of highlight (grammar, spelling, etc.)
  start: number;      // Start position in the text
  end: number;        // End position in the text
  
  // TiptapEditor expected fields
  message?: string;       // Explanation message
  wrongVersion?: string;  // Original text with error
  correctVersion?: string; // Corrected text suggestion
  
  // For backward compatibility
  meta?: {
    reason?: string;
    suggestion?: string;
  };
}

// Import styles
import '../figma-styles.css';
import '@/styles/enhanced-room.css';
import '@/styles/tts-highlight.css';

// Web Speech API type definitions
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  readonly isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: Event) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
  prototype: SpeechRecognition;
}

// Define WebkitSpeechRecognition for compatibility with other browsers
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

// Type for messages to the socket server
interface TextUpdateMessage {
  type: 'text_update';
  content: string;
  timestamp: number;
}

// Using a simplified ProtectedRoute component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => <>{children}</>;

export default function WebSpeechEnhancedPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'preparation' | 'speaking' | 'review'>('preparation');
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  
  // Speech recognition related state
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const [isWebSpeechSupported, setIsWebSpeechSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [liveTranscription, setLiveTranscription] = useState('');
  
  // Editor related state
  const editorRef = useRef<TiptapEditorHandle>(null);
  const [wordCount, setWordCount] = useState(0);
  const lastSentContentRef = useRef('');
  
  // State for AI suggestions
  const [aiSuggestions, setAiSuggestions] = useState<HighlightType[]>([]);
  const [activeHighlightId, setActiveHighlightId] = useState<string | number | null>(null);
  
  // Use Socket.IO hook for AI suggestions
  const { socket, isConnected, sendMessage, lastMessage, error: socketError } = useSocketIO();
  
  // Function to handle AI suggestion display
  const handleAiSuggestion = useCallback((data: any) => {
    console.log('Received AI suggestion:', data);
    if (!data || !editorRef.current?.editor) return;
    
    // Transform AI suggestion data to highlight format that matches the TiptapEditor's expected interface
    const highlight: HighlightType = {
      id: `suggestion-${Date.now()}`,
      start: data.start || 0,
      end: data.end || 0,
      type: data.category || 'grammar',
      message: data.reason || '',        // Use message for the explanation
      wrongVersion: data.text || '',     // Original text with error
      correctVersion: data.suggestion || '', // Suggested correction
      // Keep backwards compatibility with our internal structure
      content: data.text || '',
      from: data.start || 0,
      to: data.end || 0,
      meta: {
        reason: data.reason || '',
        suggestion: data.suggestion || ''
      }
    };
    
    console.log('Created highlight:', highlight);
    
    // Add to suggestions
    setAiSuggestions(prev => [...prev, highlight]);
  }, [editorRef]);
  
  // TOEFL question data - would come from API in production
  const [questionData, setQuestionData] = useState({
    id: 'toefl-speaking-q1',
    type: 'independent',
    title: 'Describe a Memorable Experience',
    prompt: 'Describe a memorable experience from your childhood. Explain why this experience was meaningful to you and how it has influenced your life. Include specific details in your explanation.',
    preparationTime: 15, // seconds for preparation
    responseTime: 45, // seconds for speaking
    difficultyLevel: 3,
  });
  
  // Timer effect
  useEffect(() => {
    if (timerSeconds > 0) {
      const interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            
            // Auto advance from preparation to speaking when timer ends
            if (currentStep === 'preparation') {
              setCurrentStep('speaking');
              setTimerSeconds(questionData.responseTime);
              startRecording();
            } 
            // Auto stop recording when speaking time ends
            else if (currentStep === 'speaking' && isRecording) {
              stopRecording();
              setCurrentStep('review');
            }
            
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [timerSeconds, currentStep, questionData.responseTime, isRecording]);
  
  // Browser detection
  const isBrowser = typeof window !== 'undefined' && typeof window.navigator !== 'undefined';
  
  // Initialize component
  useEffect(() => {
    if (!isBrowser) return;
    
    setLoading(false);
    
    // Get username
    if (session?.user?.name) {
      setUserName(session.user.name);
    } else {
      const storedUserName = localStorage.getItem('userName');
      if (storedUserName) {
        setUserName(storedUserName);
      }
    }
    
    // Simulate API fetch for the initial question
    fetchTOEFLQuestion();
  }, [session, isBrowser]);
  
  // Set up the TipTap editor extensions
  const extensions = useMemo(() => [
    StarterKit,
    TextStyle,
    Color,
    Placeholder.configure({
      placeholder: 'Your response will appear here as you speak...'
    }),
    HighlightExtension
  ], []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
      
      if (audioURL) {
        URL.revokeObjectURL(audioURL);
      }
    };
  }, [audioURL]);

  // Format time for display (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Handle click on highlight in the editor
  const onHighlightClick = useCallback((highlightId: string | number) => {
    setActiveHighlightId(highlightId);
    
    // Find the highlight in the suggestions
    const highlight = aiSuggestions.find(h => h.id === highlightId.toString());
    if (highlight && editorRef.current?.editor) {
      console.log('Clicked on highlight:', highlight);
      
      // Focus on the editor
      editorRef.current.editor.commands.focus();
    }
  }, [aiSuggestions]);
  
  // Fetch TOEFL question from API (mock implementation)
  const fetchTOEFLQuestion = async () => {
    try {
      // Simulate API call with a timeout
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // This would be replaced with a real API call in production
      setQuestionData({
        id: 'toefl-speaking-q1',
        type: 'independent',
        title: 'Describe a Memorable Experience',
        prompt: 'Describe a memorable experience from your childhood. Explain why this experience was meaningful to you and how it has influenced your life. Include specific details in your explanation.',
        preparationTime: 15,
        responseTime: 45,
        difficultyLevel: 3,
      });
      
      // Set initial timer for preparation phase
      setTimerSeconds(15); // 15 seconds for preparation
      setCurrentStep('preparation');
      
    } catch (error) {
      console.error('Error fetching TOEFL question:', error);
      setError('Failed to load question. Please try again.');
    }
  };
  
  // Web Speech API utility functions
  const startWebSpeechRecognition = () => {
    if (!isBrowser) return;
    
    // Define SpeechRecognition - use webkit prefix for Safari
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported by this browser');
      setIsWebSpeechSupported(false);
      return;
    }
    
    setIsWebSpeechSupported(true);
    
    // Create speech recognition instance
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    // Store the recognition instance
    speechRecognitionRef.current = recognition;
    
    // Set up event handlers
    recognition.onstart = () => {
      console.log('Speech recognition started');
    };
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let currentInterimTranscript = '';
      let finalTranscript = '';
      
      // Process results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        
        if (result.isFinal) {
          finalTranscript += text;
          console.log('Final transcript:', text);
        } else {
          currentInterimTranscript += text;
        }
      }
      
      // Update state with transcription
      if (finalTranscript) {
        setLiveTranscription(prev => {
          const updated = prev ? `${prev} ${finalTranscript}` : finalTranscript;
          
          // Update the editor content with the transcription
          if (editorRef.current) {
            const editor = editorRef.current.editor;
            if (editor) {
              // Instead of replacing all content, append to the end
              const currentPos = editor.state.doc.content.size;
              editor.commands.insertContentAt(currentPos, ` ${finalTranscript}`);
              
              // Count words for display
              const content = editor.getText();
              const wordCount = content.trim().split(/\s+/).length;
              setWordCount(wordCount || 0);
            }
          }
          
          return updated.trim();
        });
      }
      
      // Show interim results
      if (currentInterimTranscript) {
        setInterimTranscript(currentInterimTranscript);
        console.log('Interim transcript:', currentInterimTranscript);
      }
    };
    
    recognition.onerror = (event: Event) => {
      console.error('Speech recognition error:', event);
    };
    
    recognition.onend = () => {
      console.log('Speech recognition ended');
      // Restart recognition if still recording
      if (isRecording && speechRecognitionRef.current) {
        speechRecognitionRef.current.start();
      }
    };
    
    // Start recognition
    recognition.start();
  };
  
  // Audio recording functions
  const startRecording = async () => {
    // Guard against server-side rendering
    if (!isBrowser) {
      console.error('Cannot access microphone in server environment');
      return;
    }
    
    if (isRecording) return;
    
    try {
      setIsRecording(true);
      audioChunks.current = [];
      
      // Reset audio URL if there was a previous recording
      if (audioURL) {
        setAudioURL(null);
      }
      
      // Reset live transcription
      setLiveTranscription('');
      setInterimTranscript('');
      
      // Also reset editor content
      if (editorRef.current?.editor) {
        editorRef.current.editor.commands.setContent('');
      }
      
      console.log('🔴 Starting recording...');
      
      // Request microphone access
      console.log('🎤 Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      console.log('Microphone access granted');
      
      // Create MediaRecorder instance
      const options = { mimeType: 'audio/webm' };
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      
      // Start Web Speech API for transcription
      startWebSpeechRecognition();
      
      // Handle data availability to collect audio chunks for playback
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunks.current.push(e.data);
        }
      };
      
      // Handle recording stop
      recorder.onstop = () => {
        console.log('Recording stopped, creating audio blob...');
        
        // Stop speech recognition
        if (speechRecognitionRef.current) {
          speechRecognitionRef.current.stop();
          speechRecognitionRef.current = null;
        }
        
        // Create audio blob for playback
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioURL(audioUrl);
        setIsRecording(false);
        
        // Clear interim transcript
        setInterimTranscript('');
      };
      
      // Start recording with small time slices for real-time processing
      recorder.start(250);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
    }
  };
  
  // Stop recording function
  const stopRecording = () => {
    if (!isRecording) return;
    
    console.log('Stopping recording...');
    
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      
      // Stop all tracks on the stream
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    }
    
    // Stop Web Speech API
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }
    
    setInterimTranscript('');
    setIsRecording(false);
  };
  
  // Handle manual recording button
  const handleManualRecord = () => {
    if (isRecording) {
      stopRecording();
      // Move to review step
      setCurrentStep('review');
    } else {
      startRecording();
    }
  };
  
  // Handle try again
  const handleTryAgain = () => {
    // Reset states and go back to preparation
    setLiveTranscription('');
    setInterimTranscript('');
    setAudioURL(null);
    setCurrentStep('preparation');
    setTimerSeconds(questionData.preparationTime);
  };
  
  // Handle next question
  const handleNextQuestion = () => {
    // In a real app, you would fetch a new question here
    // For now, just reset everything and start over
    handleTryAgain();
    fetchTOEFLQuestion();
  };
  
  // Start the speaking test phase
  const startSpeakingPhase = () => {
    setCurrentStep('speaking');
    // Start timer for speaking duration
    setTimerSeconds(questionData.responseTime);
    
    // Start recording
    startRecording();
  };
  
  // Handle completing preparation phase
  const handleStartSpeaking = () => {
    startSpeakingPhase();
  };
  
  // Handle skipping preparation
  const handleSkipPreparation = () => {
    setCurrentStep('speaking');
    setTimerSeconds(questionData.responseTime);
    startRecording();
  };
  
  // Handle starting practice
  const handleStartPractice = () => {
    setCurrentStep('preparation');
    setTimerSeconds(questionData.preparationTime);
  };
  
  // Updates from EditorContent
  const handleEditorUpdate = useCallback(({ editor }: { editor: Editor }) => {
    if (editor) {
      // Count words
      const text = editor.getText();
      const words = text.trim().split(/\s+/).filter(word => word.length > 0);
      setWordCount(words.length);
      
      // Send content to AI for suggestions if connected
      if (isConnected && sendMessage) {
        const content = editor.getHTML();
        // Only send if content changed
        if (lastSentContentRef.current !== content) {
          lastSentContentRef.current = content;
          const message: TextUpdateMessage = {
            type: 'text_update',
            content,
            timestamp: Date.now()
          };

          // Send the message
          if (message) {
            sendMessage(message);
          }
        }
      }
    }
  }, [isConnected, sendMessage]);

  // Listen for Socket.IO events after connection is established
  useEffect(() => {
    if (isConnected && socket) {
      console.log('Socket connected, setting up listeners');
      
      // Listen for AI suggestions
      socket.on('ai_suggestion', (data) => {
        console.log('Received AI suggestion event:', data);
        handleAiSuggestion(data);
      });
      
      // Clean up listeners
      return () => {
        socket.off('ai_suggestion');
      };
    }
  }, [isConnected, socket, handleAiSuggestion]);

  // Listen for interim transcript changes to send to server
  useEffect(() => {
    // Only send to the server if the text has actually changed and there is a connection
    if (liveTranscription !== lastSentContentRef.current && isConnected && sendMessage) {
      console.log('Sending live transcription update:', liveTranscription);
      lastSentContentRef.current = liveTranscription;
      
      // Prepare the message
      const message: TextUpdateMessage = {
        type: 'text_update',
        content: liveTranscription,
        timestamp: Date.now()
      };

      // Send the message
      if (message) {
        sendMessage(message);
      }
    }
  }, [isConnected, socket, handleAiSuggestion]);

// Listen for interim transcript changes to send to server
useEffect(() => {
  // Only send to the server if the text has actually changed and there is a connection
  if (liveTranscription !== lastSentContentRef.current && isConnected && sendMessage) {
    console.log('Sending live transcription update:', liveTranscription);
    lastSentContentRef.current = liveTranscription;
    
    // Prepare the message
    const message: TextUpdateMessage = {
      type: 'text_update',
      content: liveTranscription,
      timestamp: Date.now()
    };

    // Send the message
    if (message) {
      sendMessage(message);
    }
  }
}, [isConnected, sendMessage, liveTranscription]);

// Initial test message to verify Socket.IO connection
useEffect(() => {
  if (isConnected && sendMessage) {
    sendMessage({
      type: 'test_message',
      content: 'Hello from Web Speech Enhanced page',
      timestamp: Date.now()
    });
  }
}, [isConnected, sendMessage]);

// Socket cleanup effect
useEffect(() => {
  if (socket) {
    return () => {
      // Clean up socket event listeners on unmount
      if (socket) {
        socket.off('ai_suggestion');
      }
    };
  }
}, [socket]);

// ... (rest of the code remains the same)

// Render the page
return (
  <ProtectedRoute>
    <div className="min-h-screen bg-gray-50">
      <main className="flex flex-col h-screen">
        {loading ? (
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
              <p className="mt-4 text-lg">Loading speaking test...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-screen">
            <div className="text-center text-red-600">
              <p className="text-xl">Error: {error}</p>
              <button 
                onClick={() => router.push('/speakingpage')}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 focus:outline-none"
              >
                Back to Speaking Tests
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row h-full">
            {/* Sidebar */}
            <div className="w-full md:w-1/3 lg:w-1/4 bg-white border-r border-gray-200 p-4 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Speaking Task</h2>
                <button 
                  onClick={() => router.push('/speakingpage')}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <span className="sr-only">Back</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h3 className="font-medium text-gray-800 mb-2">TOEFL Speaking Practice</h3>
                <p className="text-gray-600 text-sm mb-2">{questionData.prompt}</p>
                <div className="text-xs mt-2 text-gray-600">
                  <p className="font-medium">Title:</p>
                  <p>{questionData.title}</p>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto">
                <div className="mb-4">
                  <h3 className="font-medium text-gray-800 mb-2">Instructions</h3>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li className="flex items-start">
                      <span className="text-indigo-500 mr-2">1.</span>
                      <span>Prepare your answer for 15 seconds.</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-indigo-500 mr-2">2.</span>
                      <span>Record your response for up to 60 seconds.</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-indigo-500 mr-2">3.</span>
                      <span>Review your answer with real-time suggestions and feedback.</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-800 mb-2">{currentStep === 'preparation' ? 'Preparation' : currentStep === 'speaking' ? 'Recording' : 'Review'}</h3>
                  
                  <div className="text-center my-4">
                    <div className="text-3xl font-bold text-indigo-600">
                      {formatTime(timerSeconds)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {currentStep === 'preparation' ? 'Preparation time remaining' : currentStep === 'speaking' ? 'Recording time remaining' : 'Review your response'}
                    </p>
                  </div>
                  
                  <div className="mt-4">
                    {currentStep === 'preparation' && (
                      <button
                        onClick={handleStartSpeaking}
                        disabled={timerSeconds > 0}
                        className={`w-full inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${timerSeconds > 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none'}`}
                      >
                        {timerSeconds > 0 ? 'Preparing...' : 'Start Speaking'}
                      </button>
                    )}
                    
                    {currentStep === 'speaking' && (
                      <button
                        onClick={handleManualRecord}
                        className="w-full inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none"
                      >
                        Stop Recording
                      </button>
                    )}
                    
                    {currentStep === 'review' && (
                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            const audio = new Audio(audioURL || '');
                            audio.play();
                          }}
                          disabled={!audioURL}
                          className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                        >
                          Play Recording
                        </button>
                        <button
                          onClick={() => {
                            setCurrentStep('preparation');
                            setLiveTranscription('');
                            setTimerSeconds(15); // Assuming 15 seconds for preparation
                          }}
                          className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                        >
                          Try Again
                        </button>
                        <button
                          onClick={() => {
                            // Fetch new question and reset state
                            setCurrentStep('preparation');
                            setLiveTranscription('');
                            setTimerSeconds(15);
                            // Would typically fetch a new question here
                          }}
                          className="w-full inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                        >
                          Next Question
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Main content area */}
            <div className="flex-1 bg-white p-4 md:p-6 overflow-y-auto">
              <div className="max-w-4xl mx-auto">
                <div className="mb-4 flex items-center justify-between">
                  <h1 className="text-2xl font-bold">Web Speech API Enhanced Speaking Test</h1>
                  <div className="text-sm text-gray-600">
                    Words: <span className="font-semibold">{wordCount}</span>
                  </div>
                </div>
                
                {/* Interim transcript display */}
                {interimTranscript && (
                  <div className="mb-4 p-3 bg-indigo-50 rounded-md text-gray-700 italic">
                    {interimTranscript}
                  </div>
                )}
                
                {/* TipTap Editor and AI Feedback Section */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Your Response</h3>
                    <p className="text-sm text-gray-500">Use the editor below to review and make changes to your transcribed speech.</p>
                  </div>
                  
                  <div className="mt-2 border border-gray-200 rounded-lg p-4">
                    <TiptapEditor
                      ref={editorRef}
                      initialContent={liveTranscription}
                      onUpdate={({ editor }) => {
                        // Update word count
                        setWordCount(editor.getText().split(/\s+/).filter((word: string) => word.length > 0).length || 0);
                        
                        // Debounced content update to socket server
                        const content = editor.getHTML();
                        if (content !== lastSentContentRef.current && isConnected) {
                          lastSentContentRef.current = content;
                          sendMessage({
                            type: 'text_update',
                            content,
                            timestamp: Date.now()
                          });
                        }
                      }}
                      extensions={[HighlightExtension, StarterKit, TextStyle, Color, Placeholder]}
                      isEditable={true}
                      onHighlightClick={(id) => setActiveHighlightId(id)}
                      highlightData={aiSuggestions}
                      activeHighlightId={activeHighlightId}
                      className="prose max-w-none min-h-[200px] focus:outline-none"
                    />
                    
                    <div className="flex justify-between text-sm text-gray-500 mt-2">
                      <div>Word count: {wordCount}</div>
                      <div>{isConnected ? 'AI feedback active' : 'Connect to receive AI feedback'}</div>
                    </div>
                  </div>
                  
                  {/* AI Suggestions Panel */}
                  <div className="mt-6">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-medium">AI Feedback</h3>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto p-2 border border-gray-200 rounded">
                      {aiSuggestions.map((highlight) => (
                        <div 
                          key={highlight.id}
                          id={`suggestion-${highlight.id}`}
                          className={`p-2 border rounded-md cursor-pointer transition-colors ${
                            activeHighlightId === highlight.id 
                              ? 'bg-yellow-100 border-yellow-400' 
                              : 'bg-white border-gray-200'
                          }`}
                          onClick={() => setActiveHighlightId(highlight.id)}
                        >
                          <div className="font-medium text-sm capitalize">{highlight.type || 'Grammar'}</div>
                          
                          {/* Display the reason/explanation - using message field which is required by TiptapEditor */}
                          <div className="text-sm mt-1">
                            <span className="font-medium">Issue:</span> {highlight.message || highlight.meta?.reason || 'Grammar or spelling error detected'}
                          </div>
                          
                          {/* Display the original text and suggested correction - using wrongVersion and correctVersion */}
                          {(highlight.correctVersion || highlight.meta?.suggestion) && (
                            <div className="mt-2 text-sm">
                              <div className="font-medium text-xs mb-1">Suggestion:</div>
                              <div className="flex items-center">
                                <span className="line-through text-red-600 text-xs">{highlight.wrongVersion || highlight.content}</span>
                                <span className="mx-2 text-gray-400">→</span>
                                <span className="text-green-600 text-xs font-medium">{highlight.correctVersion || highlight.meta?.suggestion}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {aiSuggestions.length === 0 && isConnected && (
                        <div className="text-gray-500 italic p-4 text-center">AI feedback will appear here after you start typing...</div>
                      )}
                      {aiSuggestions.length === 0 && !isConnected && (
                        <div className="text-gray-500 italic p-4 text-center">Connect to the server to receive AI feedback...</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  </ProtectedRoute>
);
}
