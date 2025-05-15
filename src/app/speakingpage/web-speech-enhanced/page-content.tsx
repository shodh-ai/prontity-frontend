'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import NextTaskButton from '@/components/NextTaskButton';

// Proper type for SpeechRecognition events
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: {
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
        confidence: number;
      }
    }
  }
}

// Define the TOEFL question type
interface TOEFLQuestion {
  id: string;
  question: string;
  timeToSpeak: number;
  timeToPrep: number;
  difficulty: string;
}

// Simple protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => <>{children}</>;

function WebSpeechEnhancedContent() {
  const router = useRouter();
  
  // State for speech recognition
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [currentStep, setCurrentStep] = useState<'preparation' | 'speaking' | 'review'>('preparation');
  const [timerSeconds, setTimerSeconds] = useState(15); // Default prep time
  const [wordCount, setWordCount] = useState(0);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingData, setSavingData] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toeflQuestion, setToeflQuestion] = useState<TOEFLQuestion | null>(null);
  
  // Refs
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize the page - fetch the TOEFL question
  useEffect(() => {
    fetchTOEFLQuestion();
    
    // Clean up function
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error('Error stopping recognition:', e);
        }
      }
      if (mediaRecorderRef.current) {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          console.error('Error stopping media recorder:', e);
        }
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (audioURL) {
        URL.revokeObjectURL(audioURL);
      }
    };
  }, []);
  
  // Update word count when transcript changes
  useEffect(() => {
    if (transcript) {
      const words = transcript.trim().split(/\s+/);
      setWordCount(words.length);
    } else {
      setWordCount(0);
    }
  }, [transcript]);
  
  // Start timer based on current step
  useEffect(() => {
    if (currentStep === 'preparation' && toeflQuestion) {
      setTimerSeconds(toeflQuestion.timeToPrep);
      startTimer();
    } else if (currentStep === 'speaking' && toeflQuestion) {
      setTimerSeconds(toeflQuestion.timeToSpeak);
      startTimer();
      startRecording();
    }
  }, [currentStep, toeflQuestion]);
  
  // Start the countdown timer
  const startTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    
    timerIntervalRef.current = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          // Time's up
          clearInterval(timerIntervalRef.current!);
          
          // If in preparation phase, move to speaking phase
          if (currentStep === 'preparation') {
            setCurrentStep('speaking');
          } 
          // If in speaking phase, stop recording and move to review
          else if (currentStep === 'speaking') {
            stopRecording();
            setCurrentStep('review');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  
  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Fetch TOEFL question (mock implementation)
  const fetchTOEFLQuestion = async () => {
    try {
      // Mock data for now, would be replaced with actual API call
      const mockData: TOEFLQuestion = {
        id: 'toefl-1',
        question: 'What is your opinion on the impact of technology on education? Provide specific examples to support your answer.',
        timeToSpeak: 60, // seconds
        timeToPrep: 15,  // seconds
        difficulty: 'intermediate',
      };
      
      // Simulate network request
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update state with the question
      setToeflQuestion(mockData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching TOEFL question:', error);
      setError('Failed to load question. Please try again.');
    }
  };
  
  // Start recording
  const startRecording = async () => {
    try {
      // Only run this in the browser
      if (typeof window === 'undefined' || !navigator.mediaDevices) {
        console.error('MediaDevices API not available');
        return;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Initialize speech recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        
        recognition.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) {
              finalTranscript += result[0].transcript;
            }
          }
          setTranscript(finalTranscript);
        };
        
        recognition.onend = () => {
          // Restart if we're still in the speaking phase
          if (currentStep === 'speaking' && timerSeconds > 0) {
            recognition.start();
          }
        };
        
        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event);
        };
        
        recognition.start();
        recognitionRef.current = recognition;
      }
      
      // Initialize media recorder
      const recorder = new MediaRecorder(stream);
      audioChunks.current = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };
      
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);
        setAudioBlob(audioBlob);
      };
      
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      setError('Could not access microphone. Please check your browser permissions.');
    }
  };
  
  // Stop recording
  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
    }
    
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.error('Error stopping media recorder:', e);
      }
      setIsRecording(false);
    }
  };
  
  // Handle manually stopping the recording
  const handleManualRecord = () => {
    stopRecording();
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setCurrentStep('review');
  };
  
  // Save response and continue
  const handleSaveResponse = async () => {
    if (!audioBlob) {
      setError('No recording to save. Please try again.');
      return;
    }
    
    setSavingData(true);
    try {
      // Mock API calls
      console.log('Saving transcript:', transcript);
      console.log('Saving audio blob:', audioBlob);
      
      // Simulate network request
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSaveSuccess(true);
      setSavingData(false);
    } catch (error) {
      console.error('Error saving response:', error);
      setError('Failed to save response. Please try again.');
      setSavingData(false);
    }
  };
  
  // Handle continue to next task
  const handleContinue = () => {
    // The NextTaskButton component handles flow navigation
    console.log('Continuing to next task...');
  };
  
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <main className="flex-grow">
          {loading ? (
            <div className="flex items-center justify-center h-screen">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
                <p className="mt-4">Loading speaking practice...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-screen">
              <div className="text-center bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg max-w-md">
                <p className="font-bold text-lg mb-2">Error</p>
                <p>{error}</p>
                <button 
                  onClick={() => fetchTOEFLQuestion()}
                  className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 md:p-8 max-w-4xl mx-auto">
              <div className="mb-4">
                <button
                  onClick={() => router.push('/speakingpage')}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <span className="sr-only">Back</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
              </div>
              
              <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
                <div className="p-6">
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
                      <span>Review your response and continue to the next task.</span>
                    </li>
                  </ul>
                </div>
                
                <div className="border-t border-gray-200 p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-800">
                      {currentStep === 'preparation' ? 'Prepare Your Answer' : 
                       currentStep === 'speaking' ? 'Record Your Answer' : 'Review Your Answer'}
                    </h2>
                    <div className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-medium">
                      {formatTime(timerSeconds)}
                    </div>
                  </div>
                  
                  <div className="bg-indigo-50 p-4 rounded-lg mb-6">
                    <h3 className="font-medium text-indigo-800 mb-2">Question</h3>
                    <p className="text-indigo-900">{toeflQuestion?.question}</p>
                  </div>
                  
                  {currentStep === 'preparation' && (
                    <div className="text-center py-8">
                      <p className="text-lg text-gray-700 mb-6">Prepare your answer now...</p>
                      <p className="text-sm text-gray-500">Recording will begin automatically when preparation time ends</p>
                    </div>
                  )}
                  
                  {currentStep === 'speaking' && (
                    <div className="text-center py-4">
                      <div className="mb-4">
                        <span className="inline-block w-3 h-3 bg-red-600 rounded-full animate-pulse mr-2"></span>
                        <span className="text-red-600 font-medium">Recording</span>
                      </div>
                      
                      <div className="text-gray-700 mb-6">Speak clearly into your microphone</div>
                      
                      <button
                        onClick={handleManualRecord}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors"
                      >
                        Stop Recording
                      </button>
                    </div>
                  )}
                  
                  {currentStep === 'review' && (
                    <div className="py-4">
                      <h3 className="font-medium text-gray-800 mb-2">Your Response</h3>
                      
                      {audioURL && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-600 mb-2">Listen to your recording:</p>
                          <audio src={audioURL} controls className="w-full" />
                        </div>
                      )}
                      
                      <div className="mb-4">
                        <p className="text-sm text-gray-600 mb-2">Your transcript:</p>
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-md min-h-[100px]">
                          {transcript || <span className="text-gray-400 italic">No transcript available</span>}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">Word count: {wordCount}</div>
                      </div>
                      
                      <div className="mt-6 flex flex-col sm:flex-row sm:justify-between gap-4">
                        {!saveSuccess ? (
                          <>
                            <button
                              onClick={() => {
                                setCurrentStep('preparation');
                                setTranscript('');
                                setAudioURL(null);
                                fetchTOEFLQuestion();
                              }}
                              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md transition-colors"
                              disabled={savingData}
                            >
                              Try Again
                            </button>
                            
                            <button
                              onClick={handleSaveResponse}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors"
                              disabled={savingData}
                            >
                              {savingData ? 'Saving...' : 'Save Response'}
                            </button>
                          </>
                        ) : (
                          <div className="w-full">
                            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md">
                              Response saved successfully!
                            </div>
                            
                            <NextTaskButton 
                              onBeforeNavigate={handleContinue}
                              buttonText="Complete & Continue"
                              className="w-full py-3"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}

// Add proper TypeScript interfaces for Web Speech API
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  grammars: any;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: any) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

export default WebSpeechEnhancedContent;
