'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function AssemblyAIClient() {
  // State management
  const [transcript, setTranscript] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');

  // Refs for recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Set up cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  // Get AssemblyAI API key from environment variable
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_ASSEMBLYAI_API_KEY;
    if (key) {
      setApiKey(key);
      console.log('API key found with length:', key.length);
    } else {
      console.error('No AssemblyAI API key found in environment variables');
    }
  }, []);

  // Start recording audio
  const startRecording = async () => {
    try {
      if (!apiKey) {
        throw new Error('AssemblyAI API key is missing. Add it to your .env.local file as NEXT_PUBLIC_ASSEMBLYAI_API_KEY');
      }

      // Reset states
      setTranscript('');
      setErrorMessage('');
      setStatus('recording');
      audioChunksRef.current = [];

      // Get access to the microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create new MediaRecorder
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      // Collect audio chunks
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // When recording stops, upload audio to AssemblyAI
      recorder.onstop = async () => {
        try {
          setStatus('processing');
          setIsProcessing(true);

          // Create audio blob from chunks
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

          // Upload to AssemblyAI and get transcription
          await uploadAndTranscribe(audioBlob);

          setIsProcessing(false);
          setStatus('complete');
        } catch (error) {
          console.error('Error processing recording:', error);
          setErrorMessage(error instanceof Error ? error.message : 'Error processing recording');
          setStatus('error');
          setIsProcessing(false);
        }
      };

      // Start recording
      recorder.start();
      setIsRecording(true);

    } catch (error) {
      console.error('Error starting recording:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Error starting recording');
    }
  };

  // Stop recording
  const stopRecording = () => {
    // Stop the MediaRecorder if it exists and is recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop all tracks in the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
  };

  // Upload audio to AssemblyAI and get transcription
  const uploadAndTranscribe = async (audioBlob: Blob) => {
    try {
      // First step: Upload the audio file
      const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
          'Authorization': apiKey
        },
        body: audioBlob
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status: ${uploadResponse.status}`);
      }

      const uploadResult = await uploadResponse.json();
      console.log('Audio upload complete:', uploadResult);

      // Second step: Request transcription
      const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audio_url: uploadResult.upload_url,
          language_code: 'en_us'
        })
      });

      if (!transcriptResponse.ok) {
        throw new Error(`Transcription request failed: ${transcriptResponse.status}`);
      }

      const transcriptResult = await transcriptResponse.json();
      console.log('Transcription started:', transcriptResult);

      // Get the ID from the transcription
      const transcriptId = transcriptResult.id;

      // Poll for results
      await pollForTranscriptionResult(transcriptId);

    } catch (error) {
      console.error('Error in transcription process:', error);
      throw error;
    }
  };

  // Poll for transcription result
  const pollForTranscriptionResult = async (transcriptId: string) => {
    let complete = false;
    let attempts = 0;
    const maxAttempts = 60; // Maximum number of polling attempts

    while (!complete && attempts < maxAttempts) {
      try {
        attempts++;

        // Check status of transcription
        const pollingResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
          method: 'GET',
          headers: {
            'Authorization': apiKey
          }
        });

        if (!pollingResponse.ok) {
          throw new Error(`Polling failed: ${pollingResponse.status}`);
        }

        const result = await pollingResponse.json();
        console.log(`Polling attempt ${attempts}:`, result.status);

        // If completed, we're done
        if (result.status === 'completed') {
          complete = true;
          setTranscript(result.text);
          return;
        }

        // If there was an error in processing
        if (result.status === 'error') {
          throw new Error(`Transcription error: ${result.error}`);
        }

        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error('Error polling for result:', error);
        throw error;
      }
    }

    if (!complete) {
      throw new Error('Transcription timed out after maximum attempts');
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

  // Get button text based on status
  const getButtonText = () => {
    if (isProcessing) return 'Processing...';
    if (isRecording) return 'Stop Recording';
    return 'Start Recording';
  };

  // Get button class based on state
  const getButtonClass = () => {
    if (isProcessing) return 'bg-yellow-500 cursor-wait';
    if (isRecording) return 'bg-red-500 hover:bg-red-600';
    return 'bg-green-500 hover:bg-green-600';
  };

  // Get status text
  const getStatusText = () => {
    switch (status) {
      case 'idle':
        return 'Ready to start';
      case 'recording':
        return 'Recording audio...';
      case 'processing':
        return 'Processing transcription...';
      case 'complete':
        return 'Transcription complete';
      case 'error':
        return 'Error occurred';
      default:
        return '';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      {!apiKey && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
          <p className="font-semibold">AssemblyAI API Key Missing</p>
          <p>Add your AssemblyAI API key to .env as NEXT_PUBLIC_ASSEMBLYAI_API_KEY</p>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-4 bg-amber-50 text-amber-800 rounded border border-amber-200">
          <h3 className="font-semibold mb-2">Error Details:</h3>
          <p>{errorMessage}</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">AssemblyAI Transcription</h2>
          <p className="text-sm text-gray-500">{getStatusText()}</p>
        </div>

        <button
          onClick={toggleRecording}
          disabled={!apiKey || isProcessing}
          className={`px-4 py-2 rounded text-white font-medium transition ${getButtonClass()} ${(!apiKey || isProcessing) ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              ? 'Recording... Speak now.'
              : isProcessing
                ? 'Processing your audio... Please wait.'
                : 'Press "Start Recording" and speak. When finished, press "Stop Recording" to get your transcription.'}
          </p>
        )}
      </div>

      <div className="mt-4 text-sm bg-blue-50 p-4 rounded-lg border border-blue-100">
        <h3 className="font-semibold mb-2">About This Demo:</h3>
        <p>
          This example uses AssemblyAI's REST API for speech-to-text transcription. Unlike real-time WebSockets,
          this approach records your full message, then sends it for processing when you finish recording.
        </p>
        <p className="mt-2">
          <a
            href="https://www.assemblyai.com/docs/speech-to-text/transcribe-an-audio-file"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Learn more about AssemblyAI's transcription API
          </a>
        </p>
      </div>
    </div>
  );
}
