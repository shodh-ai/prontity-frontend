'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import { Editor } from '@tiptap/react';
import { debounce } from 'lodash';

// Import the TiptapEditor and necessary extensions
import TiptapEditor, { TiptapEditorHandle } from '@/components/TiptapEditor';
import { HighlightExtension } from '@/components/TiptapEditor/HighlightExtension';
import { Highlight as HighlightType } from '@/components/TiptapEditor/highlightInterface';
import EditorToolbar from '@/components/EditorToolbar';

// Import SocketIO hook for AI suggestions
import { useSocketIO } from '@/hooks/useSocketIO';

// Import styles from existing speaking page
import '../figma-styles.css';
import '@/styles/enhanced-room.css';
import '@/styles/tts-highlight.css';

// Type for messages to the socket server
interface TextUpdateMessage {
  type: 'text_update';
  content: string;
  timestamp: number;
}

export default function TOEFLSpeakingPracticePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'preparation' | 'speaking' | 'review'>('preparation');
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const audioChunks = useRef<BlobPart[]>([]);
  
  // Editor related state
  const editorRef = useRef<TiptapEditorHandle>(null);
  const [wordCount, setWordCount] = useState(0);
  const [editorContent, setEditorContent] = useState('');
  const editorContentRef = useRef('');
  const lastSentContentRef = useRef('');
  
  // State for AI suggestions
  const [aiSuggestions, setAiSuggestions] = useState<HighlightType[]>([]);
  const [activeHighlightId, setActiveHighlightId] = useState<string | number | null>(null);
  
  // Use Socket.IO hook for AI suggestions
  const { socket, isConnected, sendMessage, aiSuggestion, clientId, error: socketError } = useSocketIO();
  
  // TOEFL question data - would come from API in production
  const [questionData, setQuestionData] = useState({
    id: 'toefl-speaking-q1',
    type: 'independent',
    title: 'Describe a Memorable Experience',
    prompt: 'Describe a memorable experience from your childhood. Explain why this experience was meaningful to you and how it has influenced your life. Include specific details in your explanation.',
    preparationTime: 15, // seconds for preparation
    responseTime: 45, // seconds for speaking
    difficultyLevel: 3,
    tips: [
      'Organize your thoughts clearly',
      'Include specific examples',
      'Explain why it was meaningful',
      'Mention its impact on your life'
    ]
  });

  // Get username from session or localStorage when component mounts
  useEffect(() => {
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
  }, [session]);
  
  // Define Tiptap extensions
  const extensions = [
    StarterKit,
    Highlight,
    TextStyle,
    Color,
    Placeholder.configure({
      placeholder: 'Write your response here...'
    }),
    // Add our custom highlight extension
    HighlightExtension.configure({
      onHighlightClick: (highlightId) => {
        console.log(`Highlight clicked: ${highlightId}`);
        // Set the active highlight when clicked
        setActiveHighlightId(highlightId);
      }
    })
  ];

  // Fetch TOEFL question from API (mock implementation)
  const fetchTOEFLQuestion = async () => {
    setLoading(true);
    try {
      // In production, this would be an actual API call
      // const response = await fetch('/api/toefl/speaking-questions');
      // const data = await response.json();
      // setQuestionData(data);
      
      // For now, we're using the default question data
      // Simulate loading
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLoading(false);
    } catch (err) {
      console.error('Error fetching TOEFL question:', err);
      setError('Failed to load TOEFL speaking question. Please try again later.');
      setLoading(false);
    }
  };

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (currentStep === 'preparation') {
      setTimerSeconds(questionData.preparationTime);
    } else if (currentStep === 'speaking') {
      setTimerSeconds(questionData.responseTime);
    }
    
    if ((currentStep === 'preparation' || currentStep === 'speaking') && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            clearInterval(interval!);
            if (currentStep === 'preparation') {
              setCurrentStep('speaking');
              // Auto-start recording when speaking phase begins
              startRecording();
              return questionData.responseTime;
            } else if (currentStep === 'speaking') {
              setCurrentStep('review');
              // Auto-stop recording when speaking phase ends
              stopRecording();
              return 0;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentStep, questionData.preparationTime, questionData.responseTime, timerSeconds]);

  // Audio recording functions
  const startRecording = async () => {
    audioChunks.current = [];
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      recorder.ondataavailable = (e) => {
        audioChunks.current.push(e.data);
      };
      
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioURL(audioUrl);
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please check permissions and try again.");
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      
      // Stop all audio tracks to release microphone
      mediaRecorder.stream.getAudioTracks().forEach(track => track.stop());
    }
  };
  
  const handleManualRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };
  
  const handleStartPractice = () => {
    setCurrentStep('preparation');
    setTimerSeconds(questionData.preparationTime);
  };
  
  const handleSkipPreparation = () => {
    setCurrentStep('speaking');
    setTimerSeconds(questionData.responseTime);
    startRecording();
  };
  
  const handleTryAgain = () => {
    setAudioURL(null);
    setCurrentStep('preparation');
    setTimerSeconds(questionData.preparationTime);
  };
  
  const handleNextQuestion = () => {
    setAudioURL(null);
    fetchTOEFLQuestion();
    setCurrentStep('preparation');
  };
  
  const handleDone = () => {
    router.push('/roxpage');
  };
  
  // Function to send text updates to the server
  const sendTextUpdate = useCallback((content: string) => {
    if (isConnected && content !== lastSentContentRef.current) {
      const message: TextUpdateMessage = {
        type: 'text_update',
        content,
        timestamp: Date.now()
      };
      
      sendMessage(message);
      lastSentContentRef.current = content;
    } else if (!isConnected) {
      console.warn('Failed to send text update - will retry when connection is established.');
    }
  }, [isConnected, sendMessage]);

  // Create a debounced version of the send function
  const debouncedSendTextUpdate = useCallback(
    debounce((content: string) => sendTextUpdate(content), 1000, { maxWait: 5000 }),
    [sendTextUpdate]
  );
  
  // Handle editor updates
  const handleEditorUpdate = useCallback(({ editor }: { editor: Editor }) => {
    // Get content as HTML
    const html = editor.getHTML();
    // Update state and refs
    setEditorContent(html);
    editorContentRef.current = html;
    
    // Count words
    const text = editor.getText();
    const words = text.trim() ? text.trim().split(/\s+/) : [];
    setWordCount(words.length);
    
    // Send update to socket server for AI processing
    debouncedSendTextUpdate(html);
  }, [debouncedSendTextUpdate]);
  
  // Handle highlight clicks
  const handleHighlightClick = useCallback((highlightId: string | number) => {
    console.log(`Suggestion clicked: ${highlightId}`);
    setActiveHighlightId(highlightId);
  }, []);
  
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
            type: suggestion.type || 'suggestion',
            message: suggestion.message,
            wrongVersion: suggestion.wrongVersion,
            correctVersion: suggestion.correctVersion
          })) : [];
        
        setAiSuggestions(highlights);
      } catch (e) {
        console.error('Error parsing AI suggestions:', e);
      }
    }
  }, [aiSuggestion]);
  
  // When connection is established, send current content
  useEffect(() => {
    if (isConnected && editorContentRef.current) {
      // Send the current content to the server for processing
      sendTextUpdate(editorContentRef.current);
    }
  }, [isConnected, sendTextUpdate]);
  
  // Format timer as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Top navigation bar */}
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <h1 className="text-xl font-bold text-gray-900">TOEFL Speaking Practice</h1>
                </div>
              </div>
              <div className="flex items-center">
                <button
                  onClick={handleDone}
                  className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Exit Practice
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Main content */}
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading TOEFL speaking question...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 my-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                  <button
                    onClick={fetchTOEFLQuestion}
                    className="mt-2 text-sm font-medium text-red-700 hover:text-red-600"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              {/* Question header */}
              <div className="px-4 py-5 sm:px-6 bg-indigo-50">
                <h2 className="text-lg leading-6 font-medium text-gray-900">
                  {questionData.title}
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  {questionData.type === 'independent' ? 'Independent Speaking Task' : 'Integrated Speaking Task'}
                </p>
                <div className="mt-2 text-xs flex items-center">
                  <span className={`px-2 py-1 rounded-full ${isConnected 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'}`}>
                    {isConnected ? 'Connected to AI' : 'AI Disconnected'}
                  </span>
                </div>
              </div>
              
              {/* Question content */}
              <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left column - Question and Editor */}
                  <div className="md:col-span-2">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Question</h3>
                      <div className="prose max-w-none">
                        <p>{questionData.prompt}</p>
                      </div>
                      
                      {/* Tips section */}
                      <div className="mt-6">
                        <h4 className="text-md font-medium text-gray-900 mb-2">Tips</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {questionData.tips.map((tip, index) => (
                            <li key={index} className="text-sm text-gray-600">{tip}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    
                    {/* Tiptap Editor for written response */}
                    <div className="mt-6 border border-gray-300 rounded-lg p-4 bg-white">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Written Response</h3>
                      <p className="text-sm text-gray-600 mb-4">Type your response here to receive AI feedback:</p>
                      
                      {/* Editor toolbar */}
                      <EditorToolbar 
                        editor={editorRef.current?.editor ?? null} 
                        className="mb-4" 
                      />
                      
                      {/* Tiptap Editor */}
                      <TiptapEditor
                        ref={editorRef}
                        initialContent="<p>Write your response to the question here. The AI will analyze your text and provide feedback.</p>"
                        isEditable={true}
                        extensions={extensions}
                        onUpdate={handleEditorUpdate}
                        onHighlightClick={handleHighlightClick}
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
                            onClick={() => handleHighlightClick(highlight.id)}
                          >
                            <div className="font-medium text-sm capitalize">{highlight.type}</div>
                            <div className="text-sm">{highlight.message}</div>
                            {highlight.wrongVersion && highlight.correctVersion && (
                              <div className="mt-1 text-xs">
                                <span className="line-through text-red-600">{highlight.wrongVersion}</span>
                                <span className="mx-2">→</span>
                                <span className="text-green-600">{highlight.correctVersion}</span>
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
                  
                  {/* Right column - Timer and controls */}
                  <div className="md:col-span-1">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 h-full flex flex-col">
                      {currentStep === 'preparation' && (
                        <>
                          <h3 className="text-lg font-medium text-gray-900 mb-4">Preparation Time</h3>
                          <div className="text-center my-6">
                            <div className="text-3xl font-bold text-indigo-600">
                              {formatTime(timerSeconds)}
                            </div>
                            <p className="text-sm text-gray-500 mt-2">Prepare your response</p>
                          </div>
                          <div className="mt-auto space-y-3">
                            <button
                              onClick={handleSkipPreparation}
                              className="w-full inline-flex justify-center py-2 px-4 border border-indigo-500 rounded-md shadow-sm text-sm font-medium text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none"
                            >
                              Skip Preparation
                            </button>
                            {timerSeconds === questionData.preparationTime && (
                              <button
                                onClick={handleStartPractice}
                                className="w-full inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                              >
                                Start Preparation
                              </button>
                            )}
                          </div>
                        </>
                      )}
                      
                      {currentStep === 'speaking' && (
                        <>
                          <h3 className="text-lg font-medium text-gray-900 mb-4">Response Time</h3>
                          <div className="text-center my-6">
                            <div className={`text-3xl font-bold ${timerSeconds < 10 ? 'text-red-600 animate-pulse' : 'text-indigo-600'}`}>
                              {formatTime(timerSeconds)}
                            </div>
                            <p className="text-sm text-gray-500 mt-2">
                              {isRecording ? 'Recording in progress...' : 'Click record to start'}
                            </p>
                          </div>
                          <div className="flex justify-center my-6">
                            <button 
                              onClick={handleManualRecord} 
                              className={`h-16 w-16 rounded-full flex items-center justify-center ${isRecording 
                                ? 'bg-red-600 hover:bg-red-700' 
                                : 'bg-indigo-600 hover:bg-indigo-700'}`}
                            >
                              {isRecording ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
                                  <rect x="6" y="6" width="8" height="8" fill="white" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
                                  <circle cx="10" cy="10" r="6" fill="white" />
                                </svg>
                              )}
                            </button>
                          </div>
                          <div className="mt-auto">
                            <p className="text-xs text-gray-500 text-center mb-2">
                              {isRecording ? 'Click stop when finished' : 'Click record to start speaking'}
                            </p>
                          </div>
                        </>
                      )}
                      
                      {currentStep === 'review' && (
                        <>
                          <h3 className="text-lg font-medium text-gray-900 mb-4">Review Your Response</h3>
                          <div className="text-center my-6">
                            {audioURL ? (
                              <div className="bg-gray-50 rounded-lg p-4">
                                <audio 
                                  src={audioURL} 
                                  controls 
                                  className="w-full mb-3"
                                />
                                <p className="text-sm text-gray-500">Listen to your response</p>
                              </div>
                            ) : (
                              <div className="text-gray-500">
                                No recording available
                              </div>
                            )}
                          </div>
                          <div className="mt-auto space-y-3">
                            <button
                              onClick={handleTryAgain}
                              className="w-full inline-flex justify-center py-2 px-4 border border-indigo-500 rounded-md shadow-sm text-sm font-medium text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none"
                            >
                              Try Again
                            </button>
                            <button
                              onClick={handleNextQuestion}
                              className="w-full inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                            >
                              Next Question
                            </button>
                          </div>
                        </>
                      )}
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
