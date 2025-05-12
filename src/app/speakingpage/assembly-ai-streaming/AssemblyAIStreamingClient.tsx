'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function AssemblyAIStreamingClient() {
  // State management
  const [transcript, setTranscript] = useState<string>('');
  const [partialTranscript, setPartialTranscript] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  
  // Refs for audio streaming
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Add debug info with timestamp
  const addDebugInfo = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => [...prev, `${timestamp}: ${message}`].slice(-10));
    console.log(`${timestamp}: ${message}`);
  };
  
  // Get AssemblyAI API key from environment variable
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_ASSEMBLYAI_API_KEY;
    if (key) {
      setApiKey(key);
      addDebugInfo(`API key loaded, length: ${key.length}`);
    } else {
      setErrorMessage('AssemblyAI API key is missing. Add it to your .env file as NEXT_PUBLIC_ASSEMBLYAI_API_KEY');
      addDebugInfo('No API key found in environment variables');
    }
    
    // Clean up on unmount
    return () => {
      stopRecording();
    };
  }, []);
  
  // STEP 1: Connect to AssemblyAI WebSocket
  const connectToAssemblyAI = () => {
    try {
      // Reset states
      setTranscript('');
      setPartialTranscript('');
      setErrorMessage('');
      setConnectionStatus('connecting');
      addDebugInfo('Connecting to AssemblyAI WebSocket...');
      
      // Initialize WebSocket connection
      const socket = new WebSocket('wss://api.assemblyai.com/v2/realtime/ws');
      
      // Set up event handlers
      socket.onopen = () => {
        addDebugInfo('WebSocket connection opened');
        
        // Send authentication message
        const authMessage = JSON.stringify({
          token: apiKey
        });
        
        socket.send(authMessage);
        addDebugInfo('Authentication message sent');
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          addDebugInfo(`Received message type: ${data.message_type}`);
          
          if (data.message_type === 'SessionBegins') {
            // Connection and authentication successful
            setConnectionStatus('connected');
            addDebugInfo('Session began successfully, starting recording...');
            startRecording(socket);
          } else if (data.message_type === 'PartialTranscript') {
            // Update partial transcript (real-time feedback)
            setPartialTranscript(data.text || '');
          } else if (data.message_type === 'FinalTranscript') {
            // Append final transcript
            if (data.text && data.text.trim() !== '') {
              setTranscript(prev => prev + (prev ? ' ' : '') + data.text);
              setPartialTranscript('');
            }
          } else if (data.error) {
            // Handle error messages
            setErrorMessage(`AssemblyAI error: ${data.error}`);
            addDebugInfo(`Error message received: ${data.error}`);
          }
        } catch (error) {
          addDebugInfo(`Error parsing message: ${error instanceof Error ? error.message : String(error)}`);
        }
      };
      
      socket.onerror = (error) => {
        addDebugInfo(`WebSocket error: ${JSON.stringify(error)}`);
        setErrorMessage('Connection error with AssemblyAI');
        setConnectionStatus('error');
      };
      
      socket.onclose = (event) => {
        addDebugInfo(`WebSocket closed with code ${event.code}: ${event.reason || 'No reason provided'}`);
        
        if (event.code === 1000) {
          // Normal closure
          setConnectionStatus('disconnected');
        } else {
          // Abnormal closure
          setConnectionStatus('error');
          
          if (event.code === 4001) {
            setErrorMessage('Authentication failed: Invalid API key');
          } else {
            setErrorMessage(`Connection closed with code ${event.code}`);
          }
        }
        
        // Clean up recording if necessary
        if (isRecording) {
          stopMediaRecording();
        }
      };
      
      // Store socket reference
      socketRef.current = socket;
      
    } catch (error) {
      addDebugInfo(`Error connecting: ${error instanceof Error ? error.message : String(error)}`);
      setErrorMessage('Failed to connect to AssemblyAI');
      setConnectionStatus('error');
    }
  };
  
  // STEP 2: Start recording audio
  const startRecording = async (socket: WebSocket) => {
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Create MediaRecorder with proper options
      const options = { mimeType: 'audio/webm' };
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      
      // Handle audio data
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
          // Convert audio data to base64 and send
          const reader = new FileReader();
          reader.onloadend = () => {
            if (socket && socket.readyState === WebSocket.OPEN && reader.result) {
              try {
                const base64data = reader.result.toString().split(',')[1];
                socket.send(JSON.stringify({ audio_data: base64data }));
              } catch (error) {
                addDebugInfo(`Error sending audio: ${error instanceof Error ? error.message : String(error)}`);
              }
            }
          };
          reader.readAsDataURL(event.data);
        }
      };
      
      // Start recording with small chunks for real-time processing
      recorder.start(250);
      setIsRecording(true);
      addDebugInfo('Recording started');
      
    } catch (error) {
      addDebugInfo(`Error starting recording: ${error instanceof Error ? error.message : String(error)}`);
      setErrorMessage('Could not access microphone');
      setConnectionStatus('error');
    }
  };
  
  // Stop media recording (but keep connection open)
  const stopMediaRecording = () => {
    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        addDebugInfo('MediaRecorder stopped');
      } catch (error) {
        addDebugInfo(`Error stopping MediaRecorder: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      addDebugInfo('Audio tracks stopped');
    }
    
    setIsRecording(false);
  };
  
  // Stop recording and close connection
  const stopRecording = () => {
    // Stop media recording first
    stopMediaRecording();
    
    // Close WebSocket connection
    if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
      socketRef.current.close();
      socketRef.current = null;
      addDebugInfo('WebSocket connection closed');
    }
    
    setConnectionStatus('disconnected');
  };
  
  // Toggle recording
  const toggleRecording = () => {
    if (isRecording || connectionStatus === 'connected') {
      stopRecording();
    } else {
      connectToAssemblyAI();
    }
  };
  
  // Get button text based on state
  const getButtonText = () => {
    if (connectionStatus === 'connecting') return 'Connecting...';
    if (isRecording) return 'Stop Recording';
    return 'Start Recording';
  };
  
  // Get button class based on state
  const getButtonClass = () => {
    if (connectionStatus === 'connecting') return 'bg-yellow-500 cursor-wait';
    if (isRecording) return 'bg-red-500 hover:bg-red-600';
    return 'bg-green-500 hover:bg-green-600';
  };
  
  // Get status text
  const getStatusText = () => {
    switch (connectionStatus) {
      case 'disconnected': return 'Ready to start';
      case 'connecting': return 'Connecting to AssemblyAI...';
      case 'connected': return isRecording ? 'Recording and transcribing...' : 'Connected';
      case 'error': return 'Error occurred';
      default: return '';
    }
  };
  
  return (
    <div className="space-y-6">
      {/* API Key Status */}
      {!apiKey && (
        <div className="p-4 bg-red-100 text-red-700 rounded">
          <p className="font-semibold">AssemblyAI API Key Missing</p>
          <p>Add your AssemblyAI API key to .env as NEXT_PUBLIC_ASSEMBLYAI_API_KEY</p>
        </div>
      )}
      
      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 bg-amber-50 text-amber-800 rounded border border-amber-200">
          <h3 className="font-semibold mb-2">Error:</h3>
          <p>{errorMessage}</p>
        </div>
      )}
      
      {/* Controls */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Live Streaming Transcription</h2>
            <p className="text-sm text-gray-500">{getStatusText()}</p>
          </div>
          
          <button
            onClick={toggleRecording}
            disabled={!apiKey || connectionStatus === 'connecting'}
            className={`px-4 py-2 rounded text-white font-medium transition ${getButtonClass()} ${(!apiKey || connectionStatus === 'connecting') ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {getButtonText()}
          </button>
        </div>
        
        {/* Transcription Display */}
        <div className="border border-gray-200 rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto bg-gray-50">
          {/* Final transcript */}
          {transcript && (
            <p className="whitespace-pre-wrap mb-2">{transcript}</p>
          )}
          
          {/* Partial transcript (in progress) */}
          {partialTranscript && (
            <p className="whitespace-pre-wrap text-gray-500 italic">
              {partialTranscript}
            </p>
          )}
          
          {/* Placeholder */}
          {!transcript && !partialTranscript && (
            <p className="text-gray-400">
              {isRecording
                ? 'Speak now...'
                : 'Press "Start Recording" and speak into your microphone'}
            </p>
          )}
        </div>
      </div>
      
      {/* Debug Information (Developer Mode) */}
      <div className="bg-gray-100 rounded-lg p-4 border border-gray-300">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-medium">Debug Information</h3>
          <button 
            onClick={() => setDebugInfo([])} 
            className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
          >
            Clear
          </button>
        </div>
        <div className="text-xs font-mono bg-gray-800 text-gray-200 p-3 rounded max-h-[200px] overflow-y-auto">
          {debugInfo.length > 0 ? (
            <ul className="space-y-1">
              {debugInfo.map((info, index) => (
                <li key={index}>{info}</li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 italic">No debug information available</p>
          )}
        </div>
      </div>
      
      {/* About Section */}
      <div className="text-sm bg-blue-50 p-4 rounded-lg border border-blue-100">
        <h3 className="font-semibold mb-2">About This Demo:</h3>
        <p>
          This example uses AssemblyAI's WebSocket Streaming API for real-time speech-to-text transcription.
          It streams audio data from your microphone and receives transcription results as you speak.
        </p>
        <p className="mt-2">
          <a 
            href="https://www.assemblyai.com/docs/speech-to-text/streaming"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Learn more about AssemblyAI's streaming transcription
          </a>
        </p>
      </div>
    </div>
  );
}
