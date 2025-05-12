// DeepgramTranscriber.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';

// Deepgram API key should be managed server-side in production
// You'll need to set this in .env file
const DEEPGRAM_API_KEY = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;

interface DeepgramTranscriberProps {
  isRecording: boolean;
  editor: Editor | null;
  onTranscriptUpdate?: (transcript: string) => void;
}

const DeepgramTranscriber: React.FC<DeepgramTranscriberProps> = ({
  isRecording,
  editor,
  onTranscriptUpdate
}) => {
  const [transcript, setTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle');
  
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Start/stop recording based on isRecording prop
  useEffect(() => {
    if (isRecording) {
      startTranscription();
    } else if (mediaRecorderRef.current) {
      stopTranscription();
    }
    
    // Cleanup on component unmount
    return () => {
      stopTranscription();
    };
  }, [isRecording]);
  
  // Update editor content when transcript changes
  useEffect(() => {
    if (editor && transcript) {
      editor.commands.setContent(transcript);
      
      if (onTranscriptUpdate) {
        onTranscriptUpdate(transcript);
      }
    }
  }, [transcript, editor, onTranscriptUpdate]);
  
  const startTranscription = async () => {
    try {
      setStatus('connecting');
      setError(null);
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Connect to Deepgram
      const socket = new WebSocket('wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1&interim_results=true');
      
      // Set up WebSocket authentication and handlers
      socket.onopen = () => {
        console.log('Connected to Deepgram');
        setStatus('connected');
        
        // For production, never expose API keys in client-side code
        // This is for demonstration only - use a server proxy instead
        socket.send(JSON.stringify({
          type: 'Authorization',
          authorization: DEEPGRAM_API_KEY
        }));
        
        // Start recording audio
        const recorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        
        recorder.addEventListener('dataavailable', event => {
          if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            // Convert to format Deepgram expects
            const reader = new FileReader();
            reader.readAsArrayBuffer(event.data);
            reader.onloadend = () => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(reader.result as ArrayBuffer);
              }
            };
          }
        });
        
        recorder.start(250); // 250ms chunks
        mediaRecorderRef.current = recorder;
      };
      
      socket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          if (data.channel && data.channel.alternatives && data.channel.alternatives[0]) {
            const transcription = data.channel.alternatives[0].transcript;
            if (transcription && data.is_final) {
              setTranscript(prev => prev + transcription + ' ');
            }
          }
        } catch (err) {
          console.error('Error parsing transcription:', err);
        }
      };
      
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Connection error');
        setStatus('error');
      };
      
      socket.onclose = () => {
        console.log('Disconnected from Deepgram');
        setStatus('disconnected');
      };
      
      socketRef.current = socket;
      
    } catch (err) {
      console.error('Error starting transcription:', err);
      setError('Could not access microphone or connect to transcription service');
      setStatus('error');
    }
  };
  
  const stopTranscription = () => {
    // Stop the media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop all audio tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Close WebSocket connection
    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
      socketRef.current = null;
    }
    
    setStatus('idle');
  };
  
  // Hidden component, only logic, no UI
  return null;
};

export default DeepgramTranscriber;
