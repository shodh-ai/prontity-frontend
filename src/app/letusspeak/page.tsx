'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePathname } from 'next/navigation';
// Using custom auth context instead of next-auth
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import _ from 'lodash';
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import { debounce } from 'lodash';
// Import Deepgram SDK
import { createClient, LiveTranscriptionEvents, LiveTranscriptionOptions } from '@deepgram/sdk';

// Import the TiptapEditor and necessary extensions
import TiptapEditor, { TiptapEditorHandle } from '@/components/TiptapEditor';
import { HighlightExtension } from '@/components/TiptapEditor/HighlightExtension';

// Import Socket.IO hook for AI suggestions
import { useSocketIO } from '@/hooks/useSocketIO';

// Import API functions for saving transcription and audio
import { saveTranscription, uploadAudioRecording, SpeakingPracticeData } from '@/api/pronityClient';

// Define task data structure from the task generation service
interface TaskData {
  taskTitle: string;
  taskDescription: string;
  suggestedPoints: string[];
  difficultyLevel: number;
  topic: string;
  error?: string;
}

// Define types for TOEFL question data
interface TOEFLQuestion {
  id: string;
  type: string;
  title: string;
  prompt: string;
  preparationTime: number;
  responseTime: number;
  difficultyLevel: number;
  suggestedPoints?: string[];
  topic?: string;
}

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
import './figma-styles.css';
import '@/styles/enhanced-room.css';
import '@/styles/tts-highlight.css';

// Deepgram interfaces
interface DeepgramTranscription {
  channel: {
    alternatives: {
      transcript: string;
      confidence: number;
      words: Array<{
        word: string;
        start: number;
        end: number;
        confidence: number;
      }>;
    }[];
  };
  is_final: boolean;
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
  const { user, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  
  // Get flow navigation parameters from URL
  const flowPosition = parseInt(searchParams?.get('flowPosition') || '0', 10);
  const totalTasks = parseInt(searchParams?.get('totalTasks') || '0', 10);
  const taskId = searchParams?.get('taskId');
  const topicId = searchParams?.get('topicId');
  
  // Create a session-like object that mimics next-auth session structure
  const session = useMemo(() => {
    return user ? {
      user: {
        name: user.name,
        email: user.email,
        id: user.id
      }
    } : null;
  }, [user]);
  const [loading, setLoading] = useState(true);
  const [savingData, setSavingData] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'preparation' | 'speaking' | 'review'>('preparation');
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const recordingStartTimeRef = useRef<number | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  
  // Deepgram related state
  const [isDeepgramSupported, setIsDeepgramSupported] = useState(true);
  const [liveTranscription, setLiveTranscription] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const deepgramConnectionRef = useRef<any>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  
  const editorRef = useRef<TiptapEditorHandle>(null);
  const [toeflQuestion, setToeflQuestion] = useState<any>(null);
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
  
  // Split the timer logic into separate stages to prevent dependency issues
  // Phase 1: Preparation Timer (15 seconds)
  useEffect(() => {
    // Only run this effect for the preparation phase
    if (currentStep !== 'preparation') return;
    
    console.log('⏱️ PREPARATION PHASE - Starting 15 second timer');
    
    // Setup countdown from 15 seconds for preparation
    let countdown = 15;
    setTimerSeconds(countdown);
    
    const interval = setInterval(() => {
      countdown -= 1;
      
      // Log timer status
      if (countdown % 5 === 0 || countdown <= 3) {
        console.log(`⏱️ Preparation time remaining: ${countdown} seconds`);
      }
      
      setTimerSeconds(countdown);
      
      // When preparation time is up, transition to speaking phase
      if (countdown <= 0) {
        clearInterval(interval);
        console.log('✅ Preparation phase complete');
        console.log('🎤 Starting speaking phase with 45 seconds');
        
        // Change to speaking phase
        setCurrentStep('speaking');
        // Set timer for speaking phase
        setTimerSeconds(45);
        // Start recording
        startRecording();
      }
    }, 1000);
    
    // Cleanup when component unmounts or phase changes
    return () => clearInterval(interval);
  }, [currentStep]);
  
  // Phase 2: Speaking Timer (45 seconds)
  useEffect(() => {
    // Only run this effect for the speaking phase
    if (currentStep !== 'speaking') return;
    
    console.log('⏱️ SPEAKING PHASE - Starting 45 second timer');
    
    let speakingTime = timerSeconds;
    // Make sure we start with 45 seconds if timer wasn't set properly
    if (speakingTime > 45 || speakingTime <= 0) {
      speakingTime = 45;
      setTimerSeconds(45);
    }
    
    const interval = setInterval(() => {
      setTimerSeconds(prevTime => {
        const newTime = prevTime - 1;
        
        // Log timer status
        if (newTime % 5 === 0 || newTime <= 3) {
          console.log(`⏱️ Speaking time remaining: ${newTime} seconds`);
        }
        
        // When speaking time is up
        if (newTime <= 0) {
          clearInterval(interval);
          console.log('✅ Speaking phase complete');
          
          // Stop recording and navigate to report
          if (isRecording) {
            console.log('🔴 Stopping recording...');
            stopRecording();
            
            // Add a short delay before navigation
            setTimeout(() => {
              console.log('🔵 Navigating to report page...');
              handleNavigateToReport();
            }, 1000);
          }
          return 0;
        }
        
        return newTime;
      });
    }, 1000);
    
    // Cleanup when component unmounts or phase changes
    return () => clearInterval(interval);
  }, [currentStep, isRecording]);
  
  // Browser detection
  const isBrowser = typeof window !== 'undefined' && typeof window.navigator !== 'undefined';
  
  // Initialization effect - fetch question and handle flow params
  useEffect(() => {
    if (!isBrowser) return;
    
    const initPage = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Set user name if available
        if (user?.name) {
          setUserName(user.name);
        } else {
          const storedUserName = localStorage.getItem('userName');
          if (storedUserName) {
            setUserName(storedUserName);
          }
        }
        
        // Fetch the question based on topic from URL
        await fetchTOEFLQuestion();
        
        // Log flow parameters for debugging
        console.log('Flow position:', flowPosition, 'of', totalTasks);
        console.log('Task ID:', taskId);
        console.log('Topic ID:', topicId);
      } catch (err) {
        console.error('Failed to initialize page:', err);
        setError('Failed to load speaking task. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    initPage();
  }, [isBrowser, user, topicId, taskId, flowPosition, totalTasks]);
  
  // Function to start audio recording
  const startRecording = async () => {
    if (isRecording) return;
    
    try {
      setIsRecording(true);
      audioChunks.current = [];
      
      // Reset audio URL if there was a previous recording
      if (audioURL) {
        setAudioURL(null);
      }
      
      // Start tracking recording duration
      recordingStartTimeRef.current = Date.now();
      setRecordingDuration(0);
      
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
      
      // Store the microphone stream for Deepgram
      microphoneStreamRef.current = stream;
      
      // Create MediaRecorder instance for saving audio
      const options = { mimeType: 'audio/webm' };
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      
      // Start Deepgram for transcription
      startDeepgramTranscription(stream);
      
      // Handle data availability to collect audio chunks for playback
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunks.current.push(e.data);
        }
      };
      
      // Handle recording stop
      recorder.onstop = async () => {
        console.log('Recording stopped, creating audio blob...');
        
        // Stop Deepgram transcription
        if (deepgramConnectionRef.current) {
          deepgramConnectionRef.current.finish();
          deepgramConnectionRef.current = null;
        }
        
        // Calculate recording duration
        if (recordingStartTimeRef.current) {
          const durationMs = Date.now() - recordingStartTimeRef.current;
          const durationSec = Math.floor(durationMs / 1000);
          setRecordingDuration(durationSec);
          recordingStartTimeRef.current = null;
        }
        
        // Create audio blob for playback
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioURL(audioUrl);
        setIsRecording(false);
        
        // Clear interim transcript
        setInterimTranscript('');
        
        // Get the final transcription
        let transcription = liveTranscription;
        if (editorRef.current?.editor) {
          transcription = editorRef.current.editor.getText();
        }
        
        // If we have a transcription and user is logged in, save to backend
        if (transcription && localStorage.getItem('token')) {
          try {
            setSavingData(true);
            setSaveError(null);
            setSaveSuccess(false);
            
            // Get user data from localStorage
            const userJson = localStorage.getItem('user');
            const userData = userJson ? JSON.parse(userJson) : null;
            const token = localStorage.getItem('token');
            
            if (!userData || !token) {
              throw new Error('User not logged in properly');
            }
            
            // Get question text (if available)
            let questionText = 'Speaking practice session';
            if (questionData && questionData.prompt) {
              questionText = questionData.prompt;
            }
            
            // Prepare data for saving
            const speakingData: SpeakingPracticeData = {
              userId: userData.id,
              questionText: questionText,
              transcription: transcription,
              duration: recordingDuration || 0,
              practiceDate: new Date().toISOString(),
              // Add topicId from URL parameters for retrieval
              topicId: topicId || '',
              // Add taskId from URL parameters for retrieval
              taskId: taskId || ''
            };
            
            console.log('------- SAVING TO PRONITY BACKEND -------');
            console.log('Transcription data to save:', {
              userId: speakingData.userId,
              questionText: speakingData.questionText,
              transcriptionLength: speakingData.transcription.length,
              duration: speakingData.duration,
              practiceDate: speakingData.practiceDate,
              topicId: speakingData.topicId,
              taskId: speakingData.taskId
            });
            
            // Display all URL parameters for debugging
            console.log('🔍 DEBUG - URL parameters:', {
              taskId,
              topicId,
              flowPosition,
              totalTasks
            });
            
            // Log current URL for reference
            console.log('🔍 Current URL:', window.location.href);
            
            // Save transcription first
            console.log('Calling saveTranscription API...');
            let savedData;
            try {
              savedData = await saveTranscription(speakingData, token);
              console.log('✅ Transcription saved successfully!', savedData);
              
              // Store the returned ID for reference
              localStorage.setItem('lastSavedTranscriptionId', savedData?.id || '');
              localStorage.setItem('lastSavedTranscriptionTime', new Date().toISOString());
              
              // Store API URL info for debugging
              const apiUrl = process.env.NEXT_PUBLIC_PRONITY_API_URL || 'http://localhost:8000';
              
              // Log what would be sent to the speakingreport page later
              console.log('📊 Data that will be used to retrieve this transcription:', {
                retrieveUrl: `${apiUrl}/speaking/transcriptions?topicId=${encodeURIComponent(topicId || '')}&taskId=${encodeURIComponent(taskId || '')}`,
                topicId: topicId || '',
                taskId: taskId || ''
              });
            } catch (saveError) {
              console.error('❌ Error saving transcription:', saveError);
              throw saveError;
            }
            
            // Then upload the audio recording
            if (savedData && savedData.id) {
              console.log('Audio details:', {
                blobType: audioBlob.type,
                blobSize: `${(audioBlob.size / 1024).toFixed(2)} KB`,
                practiceId: savedData.id
              });
              console.log('Calling uploadAudioRecording API...');
              const audioResult = await uploadAudioRecording(audioBlob, savedData.id, token);
              console.log('Audio upload result:', audioResult);
              setSaveSuccess(true);
              console.log('✅ Transcription and audio saved successfully to pronity-backend');
            }
          } catch (error) {
            console.error('Error saving recording data:', error);
            setSaveError('Failed to save recording. ' + (error instanceof Error ? error.message : 'Unknown error'));
          } finally {
            setSavingData(false);
          }
        }
      };
      
      // Start recording with small time slices for real-time processing
      recorder.start(1000); // Collect data in 1-second chunks
      console.log('MediaRecorder started');
      
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to access microphone. Please check your permissions and try again.');
      setIsRecording(false);
    }
  };
  
  // Function to stop audio recording
  const stopRecording = () => {
    if (!isRecording || !mediaRecorderRef.current) return;
    
    console.log('Stopping recording...');
    // Stop the MediaRecorder (this will trigger the onstop event)
    mediaRecorderRef.current.stop();
    
    // Release microphone access
    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach(track => track.stop());
      microphoneStreamRef.current = null;
    }
  };

  // Format time in mm:ss format
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle starting the speaking portion of the test
  const handleStartSpeaking = () => {
    setCurrentStep('speaking');
    setTimerSeconds(questionData.responseTime);
    startRecording();
  };

  // Handle manually stopping the recording
  const handleManualRecord = () => {
    stopRecording();
    setTimerSeconds(0);
    setCurrentStep('review');
  };
  
  // Deepgram utility functions
  const startDeepgramTranscription = async (stream: MediaStream) => {
    if (!isBrowser) return;
    
    try {
      // You should store your Deepgram API key in an environment variable
      // For client-side usage, you should proxy the requests through your backend
      // This is a placeholder for the API key - DO NOT hardcode your real API key here
      const DEEPGRAM_API_KEY = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
      
      if (!DEEPGRAM_API_KEY) {
        console.error('Deepgram API key is missing. Please provide a valid API key.');
        setIsDeepgramSupported(false);
        return;
      }
      
      // Create a Deepgram client
      const deepgram = createClient(DEEPGRAM_API_KEY);
      
      // Configure the live transcription
      const options: LiveTranscriptionOptions = {
        language: 'en',
        model: 'nova-2',
        interim_results: true,
        punctuate: true,
        smart_format: true,
        diarize: false,
        encoding: 'linear16',
        sample_rate: 16000,
      };
      
      // Create a connection to Deepgram
      const connection = deepgram.listen.live(options);
      deepgramConnectionRef.current = connection;
      
      // Set up event handlers
      connection.on(LiveTranscriptionEvents.Open, () => {
        console.log('Deepgram connection established');
        
        // Create a Web Audio context to process the audio stream
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        
        // Connect the audio processor
        source.connect(processor);
        processor.connect(audioContext.destination);
        
        // Process audio data and send to Deepgram
        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Convert float32 to int16
          const int16Data = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            // Convert float32 in range [-1, 1] to int16 in range [-32768, 32767]
            int16Data[i] = Math.max(-32768, Math.min(32767, Math.floor(inputData[i] * 32768)));
          }
          
          // Send audio data to Deepgram
          connection.send(int16Data);
        };
        
        // Store the processor in the ref for cleanup
        connection.processor = processor;
        connection.source = source;
        connection.audioContext = audioContext;
      });
      
      connection.on(LiveTranscriptionEvents.Close, () => {
        console.log('Deepgram connection closed');
        
        // Clean up audio processing
        if (connection.processor && connection.source && connection.audioContext) {
          connection.source.disconnect();
          connection.processor.disconnect();
          connection.audioContext.close();
        }
      });
      
      connection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error('Deepgram error:', error);
      });
      
      connection.on(LiveTranscriptionEvents.Transcript, (data: DeepgramTranscription) => {
        // Process transcription results
        if (data.channel && data.channel.alternatives && data.channel.alternatives.length > 0) {
          const transcript = data.channel.alternatives[0].transcript;
          
          if (transcript) {
            if (data.is_final) {
              // Final transcription
              console.log('Final transcript:', transcript);
              
              setLiveTranscription(prev => {
                const updated = prev ? `${prev} ${transcript}` : transcript;
                
                // Update the editor content with the transcription
                if (editorRef.current) {
                  const editor = editorRef.current.editor;
                  if (editor) {
                    // Instead of replacing all content, append to the end
                    const currentPos = editor.state.doc.content.size;
                    editor.commands.insertContentAt(currentPos, ` ${transcript}`);
                    
                    // Count words for display
                    const content = editor.getText();
                    const wordCount = content.trim().split(/\s+/).length;
                    setWordCount(wordCount || 0);
                  }
                }
                
                return updated.trim();
              });
              
              // Clear interim transcript
              setInterimTranscript('');
            } else {
              // Interim transcription
              setInterimTranscript(transcript);
              console.log('Interim transcript:', transcript);
            }
          }
        }
      });
      
    } catch (err) {
      console.error('Failed to start Deepgram transcription:', err);
      setIsDeepgramSupported(false);
    }
  };

  // Extract topic from topicId parameter in URL
  const getTopic = () => {
    // If topicId is in format "topic-technology", extract "technology"
    if (topicId && topicId.startsWith('topic-')) {
      return topicId.substring(6);
    }
    
    // Default topics if none provided
    const defaultTopics = ['technology', 'education', 'environment', 'health', 'culture'];
    const randomIndex = Math.floor(Math.random() * defaultTopics.length);
    return defaultTopics[randomIndex];
  };
  
  // Generate a speaking task using our Python service
  const generateTask = async (topic: string): Promise<TaskData | null> => {
    try {
      console.log('Generating task for topic:', topic);
      
      // Call our task generation service
      const response = await fetch('http://localhost:5001/generate-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: topic,
          taskType: 'speaking'
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate task: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
      
    } catch (err: any) {
      console.error('Error generating task:', err);
      
      // Create a fallback task if the service is unavailable
      return {
        taskTitle: `Speaking about ${topic}`,
        taskDescription: `Talk about your experience or opinion regarding ${topic}. Provide specific examples to support your answer.`,
        suggestedPoints: ['Personal experience', 'Specific examples', 'Your opinion'],
        difficultyLevel: 3,
        topic: topic,
        error: err.message
      };
    }
  };
  
  // Fetch TOEFL question from API - now integrated with task generation service
  // Function to handle navigation to the speakingreport page using a safer approach for authentication
  const handleNavigateToReport = () => {
    console.log('🚀 Starting navigation to report page');
    
    try {
      // Get the current transcript from liveTranscription state or editor
      let currentTranscript = liveTranscription || '';
      
      // Try to get the content from the editor if available
      if (editorRef.current?.editor) {
        try {
          const editorText = editorRef.current.editor.getText();
          if (editorText && editorText.length > 0) {
            console.log('📝 Got transcript from editor, length:', editorText.length);
            currentTranscript = editorText;
          }
        } catch (editorErr) {
          console.error('Error getting text from editor:', editorErr);
        }
      }
      
      // Save data to localStorage for the report page to access
      console.log('💾 Saving transcript to localStorage, length:', currentTranscript.length);
      
      // Store transcript with HTML formatting for proper display
      if (editorRef.current?.editor) {
        const htmlContent = editorRef.current.editor.getHTML();
        localStorage.setItem('speakingTranscriptHtml', htmlContent);
      }
      
      // Store plain text version as backup
      localStorage.setItem('speakingTranscript', currentTranscript);
      
      // Add metadata about when this was recorded
      localStorage.setItem('speakingTranscriptTime', new Date().toISOString());
      
      // Create a complete task data object with all useful parameters
      const taskData = {
        id: taskId || '',
        topicId: topicId || '',
        title: questionData.title || 'Speaking Task',
        prompt: questionData.prompt || '',
        suggestedPoints: toeflQuestion?.suggestedPoints || [],
        topic: toeflQuestion?.topic || '',
        difficultyLevel: questionData.difficultyLevel || 3,
        flowPosition: flowPosition,
        totalTasks: totalTasks,
        recordedAt: new Date().toISOString()
      };
      
      console.log('💾 Saving complete task data to localStorage:', taskData);
      localStorage.setItem('speakingTask', JSON.stringify(taskData));
      
      // Additionally save the transcript directly with its task/topic IDs for easier retrieval
      const transcriptionObject = {
        userId: localStorage.getItem('userId') || 'anonymous',
        transcription: currentTranscript,
        transcriptionHtml: editorRef.current?.editor?.getHTML() || currentTranscript,
        taskId: taskId || '',
        topicId: topicId || '',
        questionText: questionData.prompt || '',
        recordedAt: new Date().toISOString(),
        duration: recordingDuration || 45
      };
      
      // Store the transcription object with the task and topic IDs as keys for direct access
      localStorage.setItem(`transcript_${taskId}_${topicId}`, JSON.stringify(transcriptionObject));
      
      // Save auth state to ensure it's available on the next page
      const authToken = localStorage.getItem('token');
      if (authToken) {
        console.log('🔑 Auth token found, ensuring it will be available on report page');
        localStorage.setItem('token', authToken);
      } else {
        console.log('⚠️ No auth token found, user might need to login');
      }
      
      // Create URL with query parameters
      const reportUrl = `/speakingreport?taskId=${taskId || 'task1'}&topicId=${topicId || 'general'}&src=speech`;
      console.log('🔗 Navigating to URL:', reportUrl);
      
      // First try router navigation which preserves the auth context better
      // but with a fallback to direct navigation
      try {
        router.push(reportUrl);
        console.log('✅ Navigation initiated with router.push');
        
        // Add a fallback in case router.push fails silently
        setTimeout(() => {
          console.log('⏳ Checking if navigation has occurred...');
          window.location.href = reportUrl;
        }, 2000);
      } catch (navError) {
        console.error('❌ Router navigation failed, using direct location:', navError);
        window.location.href = reportUrl;
      }
    } catch (error) {
      console.error('❌ Error preparing navigation:', error);
      
      // Even if there's an error in preparation, still try to navigate
      console.log('🔄 Attempting fallback navigation');
      window.location.href = '/speakingreport';
    }
  };
  
  const fetchTOEFLQuestion = async () => {
    try {
      setLoading(true);
      
      // Get topic and generate a task
      const topic = getTopic();
      const taskData = await generateTask(topic);
      
      if (!taskData) {
        throw new Error('Failed to generate task');
      }
      
      // Convert the task data to the format expected by the editor
      const toeflQ = {
        id: taskData.taskTitle || 'toefl-speaking-q1',
        type: 'independent',
        title: taskData.taskTitle,
        prompt: taskData.taskDescription,
        preparationTime: 15, // Fixed preparation time
        responseTime: 45,    // Fixed response time
        difficultyLevel: taskData.difficultyLevel,
        // Add the suggested points and topic from the task data
        suggestedPoints: taskData.suggestedPoints,
        topic: taskData.topic
      };
      
      setToeflQuestion(toeflQ);
      setQuestionData(toeflQ);
      
      console.log('Task data loaded:', taskData);
      console.log('TOEFL question set:', toeflQ);
      
      // Set initial timer for preparation phase
      setTimerSeconds(15); // 15 seconds for preparation
      setCurrentStep('preparation');
      
    } catch (error) {
      console.error('Error fetching TOEFL question:', error);
      setError('Failed to load question. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
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
              
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <h3 className="font-medium text-blue-900 mb-2">TOEFL Speaking Task</h3>
                <h4 className="font-semibold text-blue-800 mb-2">{questionData.title}</h4>
                <div className="border-l-2 border-blue-300 pl-3 my-3">
                  <p className="text-blue-800 text-sm whitespace-pre-line">{questionData.prompt}</p>
                </div>
                
                {/* Show suggested points from the API */}
                <div className="mt-4">
                  <h4 className="font-medium text-blue-900 mb-2">Suggested points to address:</h4>
                  <ul className="list-disc pl-5 text-blue-800 text-sm">
                    {/* Use default points if no suggested points are available */}
                    {toeflQuestion ? (
                      // If there's generated data with suggested points
                      toeflQuestion.suggestedPoints ? 
                        toeflQuestion.suggestedPoints.map((point: string, index: number) => (
                          <li key={index}>{point}</li>
                        )) : (
                          // Fallback for when there are no suggested points in the task data
                          <>
                            <li>Clearly state your opinion</li>
                            <li>Provide specific examples</li>
                            <li>Explain your reasoning</li>
                          </>
                        )
                    ) : (
                      // Fallback when there's no task data at all
                      <>
                        <li>Clearly state your opinion</li>
                        <li>Provide specific examples</li>
                        <li>Explain your reasoning</li>
                      </>
                    )}
                  </ul>
                </div>
                
                {/* Show difficulty level */}
                <div className="mt-3 text-xs text-blue-700">
                  Difficulty: {Array(questionData.difficultyLevel || 3).fill('⭐').join('')}
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