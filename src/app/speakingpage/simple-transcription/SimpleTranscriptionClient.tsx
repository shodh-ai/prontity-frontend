'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function SimpleTranscriptionClient() {
  // State management
  const [transcript, setTranscript] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isMicrophoneAvailable, setIsMicrophoneAvailable] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  
  // Refs for managing WebSocket and MediaRecorder
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
  // Check for microphone availability on component mount
  useEffect(() => {
    checkMicrophoneAvailability();
    
    // Clean up on unmount
    return () => {
      stopRecording();
    };
  }, []);
  
  // Check if microphone is available
  const checkMicrophoneAvailability = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsMicrophoneAvailable(true);
    } catch (error) {
      console.error('Microphone not available:', error);
      setIsMicrophoneAvailable(false);
    }
  };
  
  // Toggle recording state
  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };
  
  // Start recording and connect to Deepgram
  const startRecording = async () => {
    try {
      // Reset transcript
      setTranscript('');
      setConnectionStatus('connecting');
      
      // Get API key from environment variables
      const DEEPGRAM_API_KEY = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
      if (!DEEPGRAM_API_KEY) {
        throw new Error('Deepgram API key is missing. Add it to your .env.local file.');
      }
      
      // Get access to the microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up WebSocket connection to Deepgram
      // Following exactly the pattern from the example
      const deepgramUrl = `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000`;
      
      // Create WebSocket connection
      const socket = new WebSocket(deepgramUrl);
      socket.binaryType = 'arraybuffer';
      
      // Add API key header via socket protocol
      // This follows the example's approach
      socket.onopen = () => {
        // Authentication header
        const auth = {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`
        };
        
        // Send the authentication header
        socket.send(JSON.stringify(auth));
        
        // Create MediaRecorder once socket is open
        const options = { mimeType: 'audio/webm' };
        const recorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = recorder;
        
        // Event handler for audio data
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            // Convert Blob to ArrayBuffer
            const reader = new FileReader();
            reader.onload = () => {
              if (socket.readyState === WebSocket.OPEN && reader.result) {
                socket.send(reader.result);
              }
            };
            reader.readAsArrayBuffer(event.data);
          }
        };
        
        // Start recording
        recorder.start(250);
        setIsRecording(true);
        setConnectionStatus('connected');
      };
      
      // Handle messages from Deepgram
      socket.onmessage = (message) => {
        try {
          const received = JSON.parse(message.data);
          
          // Check if we have a transcript
          if (received.channel?.alternatives?.[0]?.transcript) {
            const transcriptText = received.channel.alternatives[0].transcript;
            
            if (transcriptText.trim() !== '') {
              setTranscript(prev => {
                // Append new text with spacing
                const newText = prev.length > 0 ? `${prev} ${transcriptText}` : transcriptText;
                return newText;
              });
            }
          }
        } catch (error) {
          console.error('Error parsing response:', error);
        }
      };
      
      // Handle connection errors
      socket.onerror = (error) => {
        console.error('WebSocket Error:', error);
        setConnectionStatus('error');
      };
      
      // Handle connection close
      socket.onclose = (event) => {
        console.log(`WebSocket closed: [${event.code}] ${event.reason || 'No reason provided'}`);
        setConnectionStatus('disconnected');
        setIsRecording(false);
      };
      
      // Save socket reference
      socketRef.current = socket;
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setConnectionStatus('error');
      alert(error instanceof Error ? error.message : 'Failed to start recording');
    }
  };
  
  // Stop recording and close connection
  const stopRecording = () => {
    // Stop MediaRecorder if exists
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      
      // Release microphone by stopping all tracks
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      
      // Clear reference
      mediaRecorderRef.current = null;
    }
    
    // Close WebSocket if exists
    if (socketRef.current) {
      // Only close if not already closed
      if (socketRef.current.readyState !== WebSocket.CLOSED) {
        socketRef.current.close();
      }
      socketRef.current = null;
    }
    
    // Update state
    setIsRecording(false);
    setConnectionStatus('disconnected');
  };
  
  // Get status text based on connection status
  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connecting':
        return 'Connecting to Deepgram...';
      case 'connected':
        return 'Connected and listening';
      case 'error':
        return 'Connection error';
      default:
        return 'Not connected';
    }
  };
  
  // Get button text based on recording state
  const getButtonText = () => {
    if (!isMicrophoneAvailable) {
      return 'Microphone not available';
    }
    
    if (connectionStatus === 'connecting') {
      return 'Connecting...';
    }
    
    return isRecording ? 'Stop Recording' : 'Start Recording';
  };
  
  // Get button color based on state
  const getButtonClass = () => {
    if (!isMicrophoneAvailable) {
      return 'bg-gray-400 cursor-not-allowed';
    }
    
    if (connectionStatus === 'connecting') {
      return 'bg-yellow-500';
    }
    
    return isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600';
  };
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Simple Deepgram Transcription</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Live Transcription</h2>
            <p className="text-sm text-gray-500">{getStatusText()}</p>
          </div>
          
          <button
            onClick={toggleRecording}
            disabled={!isMicrophoneAvailable || connectionStatus === 'connecting'}
            className={`px-4 py-2 rounded text-white font-medium transition ${getButtonClass()}`}
          >
            {getButtonText()}
          </button>
        </div>
        
        <div className="border border-gray-200 rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto bg-gray-50">
          {transcript ? (
            <p className="whitespace-pre-wrap">{transcript}</p>
          ) : (
            <p className="text-gray-400">
              {isRecording
                ? 'Speak now...'
                : 'Press "Start Recording" and speak into your microphone'}
            </p>
          )}
        </div>
      </div>
      
      <div className="text-sm text-gray-500 bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">About this example:</h3>
        <p>This is a simplified implementation of Deepgram's real-time transcription API. It follows the example from:</p>
        <a
          href="https://deepgram.com/learn/live-transcription-mic-browser"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline block mt-1"
        >
          https://deepgram.com/learn/live-transcription-mic-browser
        </a>
        <p className="mt-2">
          The implementation sends audio from your microphone directly to Deepgram's API via WebSockets
          and displays the transcribed text in real-time.
        </p>
      </div>
    </div>
  );
}
