'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import StarterKit from '@tiptap/starter-kit';
import { Editor } from '@tiptap/react';
import Placeholder from '@tiptap/extension-placeholder';
import { useSession } from 'next-auth/react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { HighlightExtension } from '@/components/TiptapEditor/HighlightExtension';
import { Highlight as HighlightType } from '@/components/TiptapEditor/highlightInterface';
import TiptapEditor, { TiptapEditorHandle } from '@/components/TiptapEditor';
import { useSocketIO } from '@/hooks/useSocketIO';
import '@/styles/tts-highlight.css';

interface TopicData {
  id: string;
  title: string;
  prompt: string;
  type: 'independent' | 'integrated';
  preparationTime: number; // seconds
  responseTime: number; // seconds
  tips: string[];
}

const SpeakingTestPage = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const { socket, isConnected, lastMessage, sendMessage } = useSocketIO();
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'intro' | 'preparation' | 'speaking' | 'review'>('intro');
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [audioURL, setAudioURL] = useState<string | null>(null);
  
  // Media recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Editor state
  const editorRef = useRef<TiptapEditorHandle>(null);
  const [liveHighlights, setLiveHighlights] = useState<HighlightType[]>([]);
  
  // Mock topic data (would come from API in production)
  const [topicData, setTopicData] = useState<TopicData>({
    id: 'topic-1',
    title: 'Describe a Challenging Experience',
    prompt: 'Describe a challenging experience you faced in your life. What made it challenging and how did you overcome it? Include specific details in your response.',
    type: 'independent',
    preparationTime: 15, // seconds
    responseTime: 45, // seconds
    tips: [
      'Organize your thoughts clearly',
      'Include specific examples',
      'Explain why it was challenging',
      'Describe how you overcame it'
    ]
  });
  
  // Tiptap extensions
  const extensions = [
    StarterKit,
    Placeholder.configure({
      placeholder: 'Your transcript will appear here...',
    }),
    // Add our custom highlight extension
    HighlightExtension.configure({
      onHighlightClick: (highlightId) => {
        console.log(`Highlight clicked: ${highlightId}`);
      }
    })
  ];
  
  // Socket.IO event handlers
  useEffect(() => {
    if (!socket) return;
    
    // Handler for real-time STT results
    const handleLiveSTTResult = (data: { transcript_segment: string }) => {
      console.log('Received live STT result:', data.transcript_segment);
      
      // Update our transcript state
      setTranscript(prev => prev + data.transcript_segment);
      
      // Update the editor if it exists
      if (editorRef.current?.editor) {
        // Insert at the end of current content
        const editor = editorRef.current.editor;
        const doc = editor.state.doc;
        editor.commands.insertContentAt(doc.content.size, data.transcript_segment);
      }
    };
    
    // Handler for live grammar highlights
    const handleLiveGrammarHighlight = (highlights: HighlightType[]) => {
      console.log('Received live grammar highlights:', highlights);
      setLiveHighlights(prev => {
        // Merge highlights (simple append for now)
        // In a real implementation, you'd want to be smarter about merging/replacing
        return [...prev, ...highlights];
      });
    };
    
    // Handler for test completion
    const handleTestCompleted = (data: { reportId: string }) => {
      console.log('Test completed, report ID:', data.reportId);
      // Store report ID for later viewing or navigate to report page
    };
    
    // Set up listeners
    socket.on('live_stt_result', handleLiveSTTResult);
    socket.on('live_grammar_highlight', handleLiveGrammarHighlight);
    socket.on('test_completed_summary', handleTestCompleted);
    
    // Clean up listeners on unmount
    return () => {
      socket.off('live_stt_result', handleLiveSTTResult);
      socket.off('live_grammar_highlight', handleLiveGrammarHighlight);
      socket.off('test_completed_summary', handleTestCompleted);
    };
  }, [socket]);
  
  // Audio recording functions
  const startRecording = useCallback(async () => {
    try {
      // Reset audio chunks and transcript
      audioChunksRef.current = [];
      setTranscript('');
      
      // Reset the editor content
      if (editorRef.current?.editor) {
        editorRef.current.editor.commands.setContent('');
      }
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Create a new MediaRecorder instance
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: 'audio/webm;codecs=opus' 
      });
      mediaRecorderRef.current = mediaRecorder;
      
      // Handle audio data as it becomes available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          
          // Send this chunk to the server for STT processing
          if (isConnected && socket) {
            // For development, we'll send the audio as base64
            // In production, you would use a more efficient method
            const reader = new FileReader();
            reader.readAsDataURL(event.data);
            reader.onloadend = () => {
              // Strip off the data URL prefix to get just the base64 string
              // Format: "data:audio/webm;codecs=opus;base64,<actual base64 data>"
              const base64Data = reader.result?.toString().split(',')[1];
              sendMessage({
                type: 'audio_chunk',
                audio_data: base64Data,
                mime_type: event.data.type
              });
            };
          }
        }
      };
      
      // Start recording, capturing chunks at regular intervals
      mediaRecorder.start(1000); // Capture a chunk every 1 second
      setIsRecording(true);
      
      // Let the server know we're starting a test
      if (isConnected && socket) {
        sendMessage({
          type: 'start_speaking_test',
          topic_id: topicData.id,
          timestamp: Date.now()
        });
      }
      
      // Set up a timer for recording time
      let startTime = Date.now();
      timerRef.current = setInterval(() => {
        const currentTime = Math.floor((Date.now() - startTime) / 1000);
        setTimerSeconds(currentTime);
        
        // Auto-stop recording when time is up
        if (currentStep === 'speaking' && currentTime >= topicData.responseTime) {
          stopRecording();
          setCurrentStep('review');
        }
      }, 100);
    } catch (err) {
      console.error('Error starting recording:', err);
      alert('Failed to access microphone. Please check your permissions and try again.');
    }
  }, [currentStep, isConnected, sendMessage, socket, topicData.id, topicData.responseTime]);
  
  // Stop recording function
  const stopRecording = useCallback(() => {
    // Stop the media recorder if it exists and is recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Clear the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Stop and release the microphone stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Create a full audio blob from all chunks
    if (audioChunksRef.current.length > 0) {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
      const url = URL.createObjectURL(audioBlob);
      setAudioURL(url);
      
      // Let the server know we're ending the test
      if (isConnected && socket) {
        sendMessage({
          type: 'end_speaking_test',
          topic_id: topicData.id,
          transcript: transcript,
          timestamp: Date.now()
        });
      }
    }
    
    setIsRecording(false);
  }, [isConnected, sendMessage, socket, topicData.id, transcript]);
  
  // Timer for preparation phase
  useEffect(() => {
    if (currentStep === 'preparation') {
      setTimerSeconds(topicData.preparationTime);
      
      const timer = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setCurrentStep('speaking');
            startRecording();
            return topicData.responseTime;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [currentStep, startRecording, topicData.preparationTime, topicData.responseTime]);
  
  // Format timer as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Handle start preparation phase
  const handleStartPreparation = () => {
    setCurrentStep('preparation');
    setIsPreparing(true);
  };
  
  // Handle skip preparation
  const handleSkipPreparation = () => {
    setCurrentStep('speaking');
    startRecording();
  };
  
  // Handle try again
  const handleTryAgain = () => {
    setCurrentStep('preparation');
    setAudioURL(null);
  };
  
  // Handle exit
  const handleExit = () => {
    router.push('/speakingpage');
  };
  
  // Handle editor update
  const handleEditorUpdate = ({ editor }: { editor: Editor }) => {
    // This is optional - you might not need this handler
    // if you're only updating the editor via the live STT results
  };
  
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <h1 className="text-xl font-bold text-gray-900">Speaking Test</h1>
              <div className="flex items-center space-x-4">
                <div className={`px-3 py-1 rounded-full text-xs ${
                  isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </div>
                <button
                  onClick={handleExit}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                >
                  Exit
                </button>
              </div>
            </div>
          </div>
        </header>
        
        {/* Main content */}
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            {/* Topic header */}
            <div className="px-4 py-5 sm:px-6 bg-indigo-50">
              <h2 className="text-lg leading-6 font-medium text-gray-900">
                {topicData.title}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {topicData.type === 'independent' ? 'Independent Speaking Task' : 'Integrated Speaking Task'}
              </p>
              
              {/* Current phase indicator */}
              <div className="mt-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {currentStep === 'intro' && 'Instructions'}
                  {currentStep === 'preparation' && 'Preparation Phase'}
                  {currentStep === 'speaking' && 'Speaking Phase'}
                  {currentStep === 'review' && 'Review Phase'}
                </span>
              </div>
            </div>
            
            {/* Content */}
            <div className="border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
                {/* Left column - Topic & Transcript */}
                <div className="md:col-span-2 space-y-6">
                  {/* Topic section */}
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Topic</h3>
                    <div className="prose max-w-none">
                      <p>{topicData.prompt}</p>
                    </div>
                    
                    {/* Tips */}
                    <div className="mt-6">
                      <h4 className="font-medium text-gray-900 mb-2">Tips</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        {topicData.tips.map((tip, index) => (
                          <li key={index} className="text-sm text-gray-600">{tip}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  
                  {/* Transcript section */}
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium text-gray-900">Live Transcript</h3>
                      <span className="text-sm text-gray-500">
                        {isRecording ? 'Recording in progress...' : 'Not recording'}
                      </span>
                    </div>
                    
                    {/* TiptapEditor for transcript */}
                    <div className="min-h-[200px] bg-gray-50 rounded border border-gray-200 p-4">
                      <TiptapEditor
                        ref={editorRef}
                        initialContent=""
                        isEditable={false} // Read-only since it's populated by STT
                        extensions={extensions}
                        onUpdate={handleEditorUpdate}
                        highlightData={liveHighlights}
                        className="prose max-w-none min-h-[180px]"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Right column - Timer & Controls */}
                <div className="md:col-span-1">
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 h-full flex flex-col">
                    {/* Timer display */}
                    <div className="text-center mb-6">
                      <div className={`text-4xl font-bold ${
                        timerSeconds < 10 && currentStep !== 'intro'
                          ? 'text-red-600 animate-pulse' 
                          : 'text-indigo-600'
                      }`}>
                        {formatTime(timerSeconds)}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {currentStep === 'preparation' && 'Preparation Time Remaining'}
                        {currentStep === 'speaking' && 'Speaking Time Remaining'}
                        {currentStep === 'intro' && 'Ready to begin'}
                        {currentStep === 'review' && 'Test Complete'}
                      </p>
                    </div>
                    
                    {/* Audio visualization */}
                    {isRecording && (
                      <div className="mb-6">
                        <div className="h-16 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                          <div className="flex items-end h-12 space-x-1">
                            {/* Animated audio bars */}
                            {[...Array(20)].map((_, i) => (
                              <div
                                key={i}
                                className="w-1 bg-indigo-500 rounded-t"
                                style={{
                                  height: `${Math.max(15, Math.floor(Math.random() * 48))}px`,
                                  animationDelay: `${i * 0.05}s`,
                                  animation: 'pulse 1s infinite',
                                }}
                              ></div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Audio playback in review phase */}
                    {currentStep === 'review' && audioURL && (
                      <div className="mb-6">
                        <h4 className="font-medium text-gray-900 mb-2">Your Recording</h4>
                        <audio
                          src={audioURL}
                          controls
                          className="w-full"
                        ></audio>
                      </div>
                    )}
                    
                    {/* Phase-specific controls */}
                    <div className="mt-auto space-y-3">
                      {currentStep === 'intro' && (
                        <>
                          <button
                            onClick={handleStartPreparation}
                            className="w-full inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                          >
                            Start Preparation
                          </button>
                          <button
                            onClick={handleSkipPreparation}
                            className="w-full inline-flex justify-center py-2 px-4 border border-indigo-500 rounded-md shadow-sm text-sm font-medium text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none"
                          >
                            Skip to Speaking
                          </button>
                        </>
                      )}
                      
                      {currentStep === 'preparation' && (
                        <button
                          onClick={handleSkipPreparation}
                          className="w-full inline-flex justify-center py-2 px-4 border border-indigo-500 rounded-md shadow-sm text-sm font-medium text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none"
                        >
                          Skip Preparation
                        </button>
                      )}
                      
                      {currentStep === 'speaking' && (
                        <button
                          onClick={stopRecording}
                          className="w-full inline-flex justify-center py-2 px-4 border border-red-500 rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none"
                        >
                          Stop Recording
                        </button>
                      )}
                      
                      {currentStep === 'review' && (
                        <>
                          <button
                            onClick={handleTryAgain}
                            className="w-full inline-flex justify-center py-2 px-4 border border-indigo-500 rounded-md shadow-sm text-sm font-medium text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none"
                          >
                            Try Again
                          </button>
                          <button
                            onClick={handleExit}
                            className="w-full inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                          >
                            View Report
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
};

export default SpeakingTestPage;
