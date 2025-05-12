'use client';

import { useState, useEffect, useRef } from 'react';

export default function DeepgramTest() {
  const [transcript, setTranscript] = useState<string>('');
  const [recording, setRecording] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [mounted, setMounted] = useState<boolean>(false);
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const [connecting, setConnecting] = useState<boolean>(false);
  const [connectionMethod, setConnectionMethod] = useState<string>('url');
  const [detailedError, setDetailedError] = useState<string>('');
  
  // Fix hydration issues by only running browser-specific code after component mount
  useEffect(() => {
    setMounted(true);
    
    // Get API key on component mount
    const key = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY || '';
    console.log('API key available:', key ? 'Yes' : 'No');
    setApiKey(key);

    // Clean up on unmount
    return () => {
      if (mounted) {
        stopRecording();
      }
    };
  }, [mounted]);
  
  // Create a stopRecording function that works with useEffect
  const stopRecording = () => {
    // Only run in browser environment
    if (typeof window !== 'undefined') {
      // Stop the MediaRecorder
      if (mediaRecorderRef.current) {
        console.log('Stopping MediaRecorder...');
        mediaRecorderRef.current.stop();
        
        // Stop all tracks to release microphone
        mediaRecorderRef.current.stream.getTracks().forEach(track => {
          track.stop();
          console.log('Audio track stopped');
        });
        mediaRecorderRef.current = null;
      }

      // Close the WebSocket connection
      if (socketRef.current) {
        console.log('Closing Deepgram connection...');
        socketRef.current.close();
        socketRef.current = null;
      }

      setRecording(false);
      setConnecting(false);
    }
  };

  const startRecording = async () => {
    try {
      setError('');
      setDetailedError('');
      setTranscript('');
      setConnecting(true);
      
      // Validate API key
      if (!apiKey) {
        setError('Deepgram API key is missing! Check your .env file.');
        setConnecting(false);
        return;
      }

      // 1. Get microphone stream
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      console.log('Microphone access granted');

      // 2. Connect to Deepgram
      // Try using URI encoded API key
      const encodedKey = encodeURIComponent(apiKey);
      // Logging - but mask most of key for security
      const maskedKey = apiKey.substring(0, 5) + '...' + apiKey.substring(apiKey.length - 5);
      console.log(`Using API key (masked): ${maskedKey}`);
      
      let socket: WebSocket;
      
      if (connectionMethod === 'url') {
        // Method 1: Include token in URL
        const url = `wss://api.deepgram.com/v1/listen?encoding=webm&sample_rate=16000&interim_results=true&token=${encodedKey}`;
        console.log('Creating WebSocket connection with token in URL...');
        socket = new WebSocket(url);
      } else {
        // Method 2: Use protocol header approach
        const url = 'wss://api.deepgram.com/v1/listen?encoding=webm&sample_rate=16000&interim_results=true';
        console.log('Creating WebSocket connection with token as protocol...');
        socket = new WebSocket(url, [`token:${apiKey}`]);
      }
      
      socketRef.current = socket;

      // Set up WebSocket event handlers with detailed logging
      socket.onopen = () => {
        console.log('✅ Connected to Deepgram successfully!');
        setConnecting(false);
        
        // Once connected to Deepgram, start recording
        console.log('Starting MediaRecorder...');
        const options = { mimeType: 'audio/webm' };
        const recorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = recorder;
        
        // Handle audio data and send to Deepgram
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(event.data);
            console.log(`Sent audio chunk (${event.data.size} bytes) to Deepgram`);
          }
        };
        
        // Start recording with small chunks for real-time transcription
        recorder.start(250);
        setRecording(true);
      };

      socket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          console.log('Received from Deepgram:', data);
          
          // Extract transcript from the result
          if (data.channel?.alternatives?.[0]?.transcript) {
            const text = data.channel.alternatives[0].transcript;
            console.log('Transcript:', text);
            setTranscript(prev => prev + ' ' + text);
          }
        } catch (error) {
          console.error('Error parsing Deepgram response:', error);
        }
      };

      socket.onerror = (event) => {
        console.error('Deepgram connection error:', event);
        setConnecting(false);
        
        // Provide more detailed error information
        const errorInfo = `Error connecting to Deepgram. This could be due to:
- Invalid API key
- Network connectivity issues
- CORS restrictions in the browser
- Try using a different connection method`;
        
        setDetailedError(errorInfo);
        setError('Failed to connect to Deepgram. See details below.');
      };

      socket.onclose = (event) => {
        console.log(`Disconnected from Deepgram: [${event.code}] ${event.reason || 'No reason provided'}`);
        setConnecting(false);
        
        // Provide error details based on WebSocket close code
        let closeReason = '';
        switch(event.code) {
          case 1000:
            closeReason = 'Normal closure - connection successfully completed';
            break;
          case 1006:
            closeReason = 'Abnormal closure - connection closed unexpectedly. This may be due to authentication issues or network problems.';
            break;
          case 1008:
            closeReason = 'Policy violation - likely an authentication issue with your API key.';
            break;
          case 1011:
            closeReason = 'Internal server error - Deepgram server encountered an error.';
            break;
          default:
            closeReason = `Unknown close code ${event.code} - ${event.reason || 'No reason provided'}`;
        }
        
        if (event.code !== 1000 && !error) {
          setDetailedError(`WebSocket closed: ${closeReason}`);
        }
      };
    } catch (error) {
      console.error('Error starting recording:', error);
      setError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // The stopRecording function is now defined above

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Deepgram Speech-to-Text Test</h1>
      
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {detailedError && (
        <div className="mb-4 p-4 bg-amber-50 text-amber-800 rounded border border-amber-200">
          <h3 className="font-semibold mb-2">Detailed Error Information:</h3>
          <pre className="whitespace-pre-wrap text-sm">{detailedError}</pre>
        </div>
      )}
      
      <div className="mb-4">
        <p className="mb-2">API Key Status: {apiKey ? '✅ Available' : '❌ Missing'}</p>
        {!apiKey && (
          <p className="text-amber-600">
            Add your Deepgram API key to .env as NEXT_PUBLIC_DEEPGRAM_API_KEY
          </p>
        )}
      </div>
      
      <div className="mb-4">
        <h2 className="text-md font-semibold mb-2">Connection Method:</h2>
        <div className="flex space-x-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="connectionMethod"
              value="url"
              checked={connectionMethod === 'url'}
              onChange={() => setConnectionMethod('url')}
              disabled={recording || connecting}
              className="mr-2"
            />
            Token in URL
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="connectionMethod"
              value="protocol"
              checked={connectionMethod === 'protocol'}
              onChange={() => setConnectionMethod('protocol')}
              disabled={recording || connecting}
              className="mr-2"
            />
            Token as Protocol
          </label>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          If one method doesn't work, try the other - some browsers handle WebSocket protocols differently.
        </p>
      </div>
      
      <div className="mb-6">
        <button
          onClick={recording ? stopRecording : startRecording}
          className={`px-6 py-3 rounded font-medium ${
            recording
              ? 'bg-red-500 hover:bg-red-600'
              : connecting 
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600'
          } text-white`}
          disabled={!apiKey || connecting}
        >
          {recording ? 'Stop Recording' : connecting ? 'Connecting...' : 'Start Recording'}
        </button>
      </div>
      
      <div className="border p-4 rounded h-64 overflow-y-auto bg-gray-50">
        <h2 className="text-lg font-semibold mb-2">Live Transcription:</h2>
        <p>{transcript || (recording ? 'Listening...' : connecting ? 'Connecting to Deepgram...' : 'Press Start Recording and speak...')}</p>
      </div>
      
      <div className="mt-4 text-sm bg-blue-50 p-4 rounded border border-blue-200">
        <h3 className="font-semibold mb-2">Troubleshooting:</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Make sure your Deepgram API key is correctly set in the .env file</li>
          <li>Check the browser console for detailed error messages</li>
          <li><strong>If you see WebSocket error 1006</strong>: This is an authentication issue. Try:
            <ul className="list-disc pl-5 mt-1">
              <li>Using a different connection method (URL vs Protocol)</li>
              <li>Making sure your API key is valid and active</li>
              <li>Testing from a different browser or network</li>
            </ul>
          </li>
          <li>Some browsers have security restrictions with WebSockets - Chrome usually works best</li>
        </ul>
      </div>
      
      <div className="mt-4 text-xs text-gray-500">
        <p>Note: WebSocket errors like 1006 (abnormal closure) are often related to authentication, CORS, or network issues.
        If you're testing locally, make sure your API key has the necessary permissions.</p>
      </div>
    </div>
  );
}
