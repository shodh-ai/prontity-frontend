'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// Web Speech API interfaces
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
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
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

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

export default function WebSpeechTestPage() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isWebSpeechSupported, setIsWebSpeechSupported] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  
  // References
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  
  // Check for Web Speech API support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsWebSpeechSupported(true);
      console.log('Web Speech API is supported in this browser');
    } else {
      console.warn('Web Speech API is not supported in this browser');
    }
  }, []);
  
  // Update word count when transcript changes
  useEffect(() => {
    if (transcript) {
      const words = transcript.trim().split(/\s+/).filter(word => word.length > 0);
      setWordCount(words.length);
    } else {
      setWordCount(0);
    }
  }, [transcript]);
  
  // Start Web Speech API recognition
  const startWebSpeechRecognition = () => {
    if (!isWebSpeechSupported) {
      console.error('Web Speech API not supported in this browser');
      return;
    }
    
    try {
      // Create speech recognition instance
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      // Configure recognition
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US'; // Set to English
      
      // Store in ref for later access
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
          setTranscript(prev => {
            const updated = prev ? `${prev} ${finalTranscript}` : finalTranscript;
            return updated.trim();
          });
        }
        
        // Show interim results
        if (currentInterimTranscript) {
          setInterimTranscript(currentInterimTranscript);
          console.log('Interim transcript:', currentInterimTranscript);
        }
      };
      
      recognition.onerror = (event) => {
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
      
    } catch (error) {
      console.error('Error initializing speech recognition:', error);
    }
  };
  
  // Start recording with both audio capture and speech recognition
  const startRecording = async () => {
    if (isRecording) return;
    
    try {
      // Reset states
      setIsRecording(true);
      setTranscript('');
      setInterimTranscript('');
      audioChunks.current = [];
      
      // Reset audio URL if there was a previous recording
      if (audioURL) {
        setAudioURL(null);
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
      
      // Create MediaRecorder instance for audio capture
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
        
        // Create audio blob for playback
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioURL(audioUrl);
      };
      
      // Start recording with small time slices for real-time processing
      recorder.start(250);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
    }
  };
  
  // Stop recording
  const stopRecording = () => {
    if (!isRecording) return;
    
    console.log('Stopping recording...');
    
    // Stop the MediaRecorder
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      
      // Release microphone by stopping all tracks
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => {
          track.stop();
          console.log('Audio track stopped');
        });
      }
    }
    
    // Stop speech recognition
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }
    
    setIsRecording(false);
  };
  
  // Handle the record button click
  const handleRecordButton = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">Web Speech API Test</h1>
        
        {!isWebSpeechSupported && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p className="font-bold">Web Speech API is not supported</p>
            <p>This browser does not support Web Speech API. Please try using Chrome or Edge.</p>
          </div>
        )}
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-center mb-6">
            <button 
              onClick={handleRecordButton}
              disabled={!isWebSpeechSupported}
              className={`h-16 w-16 rounded-full flex items-center justify-center transition-colors ${
                isRecording 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              } ${!isWebSpeechSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
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
          
          <div className="mb-4 text-center">
            <p className="text-sm text-gray-500">
              {isRecording ? 'Click to stop recording' : 'Click to start recording'}
            </p>
          </div>
          
          <div className="mb-6">
            <h2 className="text-lg font-medium mb-2">Live Transcription</h2>
            <div className="min-h-[200px] border border-gray-300 rounded-md p-3 bg-gray-50">
              {transcript && (
                <p className="text-gray-800">{transcript}</p>
              )}
              {interimTranscript && (
                <p className="text-gray-500 italic">{interimTranscript}</p>
              )}
              {!transcript && !interimTranscript && (
                <p className="text-gray-400">Your speech will appear here...</p>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">Word count: {wordCount}</p>
          </div>
          
          {audioURL && (
            <div className="mt-6">
              <h2 className="text-lg font-medium mb-2">Recording Playback</h2>
              <audio 
                src={audioURL} 
                controls 
                className="w-full"
              />
            </div>
          )}
        </div>
        
        <div className="text-center">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-800"
          >
            Back to Speaking Page
          </button>
        </div>
      </div>
    </div>
  );
}
