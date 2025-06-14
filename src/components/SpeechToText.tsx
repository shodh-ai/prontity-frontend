'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { MicIcon, Square, TrashIcon } from 'lucide-react';

interface SpeechToTextProps {
  onTextChange?: (text: string) => void;
  onRecordingChange?: (isRecording: boolean) => void;
  placeholder?: string;
  className?: string;
  autoStart?: boolean;
}

const SpeechToText: React.FC<SpeechToTextProps> = ({
  onTextChange,
  onRecordingChange,
  placeholder = 'Start speaking to see transcription...',
  className = '',
  autoStart = false
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<any | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      // @ts-ignore - TypeScript doesn't have built-in types for webkit prefixed APIs
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';
      
      setRecognition(recognitionInstance);
      
      // Auto start if specified
      if (autoStart) {
        setTimeout(() => {
          startRecording(recognitionInstance);
        }, 500);
      }
    }
    
    return () => {
      if (recognition) {
        try {
          recognition.stop();
        } catch (e) {
          // Ignore errors when stopping on unmount
        }
      }
    };
  }, [autoStart]);

  // Set up recognition event handlers
  useEffect(() => {
    if (!recognition) return;
    
    recognition.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript + ' ';
      }
      setTranscript(currentTranscript.trim());
      if (onTextChange) onTextChange(currentTranscript.trim());
    };
    
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      if (event.error === 'not-allowed') {
        setTranscript('Microphone access denied. Please enable microphone permissions.');
      }
      setIsRecording(false);
      if (onRecordingChange) onRecordingChange(false);
    };
    
    recognition.onend = () => {
      // Only update state if we're still mounted
      setIsRecording(false);
      if (onRecordingChange) onRecordingChange(false);
    };
  }, [recognition, onTextChange, onRecordingChange]);

  // Function to start recording
  const startRecording = useCallback((instance = recognition) => {
    if (!instance) {
      setTranscript('Speech recognition is not supported in this browser.');
      return;
    }
    
    try {
      instance.start();
      setIsRecording(true);
      if (onRecordingChange) onRecordingChange(true);
    } catch (error) {
      console.error('Error starting speech recognition:', error);
    }
  }, [recognition, onRecordingChange]);

  // Function to stop recording
  const stopRecording = useCallback(() => {
    if (!recognition) return;
    
    try {
      recognition.stop();
      setIsRecording(false);
      if (onRecordingChange) onRecordingChange(false);
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
    }
  }, [recognition, onRecordingChange]);

  // Function to clear transcript
  const clearTranscript = () => {
    setTranscript('');
    if (onTextChange) onTextChange('');
  };

  // Determine if speech recognition is available
  const isSpeechRecognitionAvailable = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-medium">Speech to Text</h3>
          <div className="flex space-x-2">
            {!isRecording ? (
              <Button 
                onClick={() => startRecording()}
                disabled={!isSpeechRecognitionAvailable || isRecording}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <MicIcon className="w-4 h-4 mr-1" />
                Start
              </Button>
            ) : (
              <Button 
                onClick={stopRecording}
                size="sm"
                variant="destructive"
              >
                <Square className="w-4 h-4 mr-1" />
                Stop
              </Button>
            )}
            <Button 
              onClick={clearTranscript}
              disabled={!transcript}
              size="sm"
              variant="outline"
            >
              <TrashIcon className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
        
        <div className={`min-h-[100px] max-h-[200px] overflow-y-auto p-3 rounded-md border ${
          isRecording ? 'border-blue-300 bg-blue-50' : 'border-gray-300 bg-gray-50'
        }`}>
          {transcript ? (
            <p>{transcript}</p>
          ) : (
            <p className="text-gray-400">{placeholder}</p>
          )}
        </div>
        
        {!isSpeechRecognitionAvailable && (
          <p className="text-red-500 text-sm">
            Speech recognition is not supported in your browser. Try Chrome or Edge for best experience.
          </p>
        )}
        
        {isRecording && (
          <div className="flex items-center space-x-2 text-sm text-blue-600">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </span>
            <span>Listening...</span>
          </div>
        )}
      </div>
    </Card>
  );
};

export default SpeechToText;
