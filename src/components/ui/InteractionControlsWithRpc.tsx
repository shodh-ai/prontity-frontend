import React, { useState, useRef, useEffect } from 'react';
import { Room } from 'livekit-client';
import { Mic, MicOff, HandMetal } from 'lucide-react';
import { FrontendButtonClickRequest } from '@/generated/protos/interaction';
import { AgentInteractionClientImpl } from '@/generated/protos/interaction';

interface InteractionControlsWithRpcProps {
  room: Room;
  userName: string;
  agentServiceClient: AgentInteractionClientImpl;
  className?: string;
  onDoubtResponse?: (response: any) => void;
}

const InteractionControlsWithRpc: React.FC<InteractionControlsWithRpcProps> = ({
  room,
  userName,
  agentServiceClient,
  className = '',
  onDoubtResponse
}) => {
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  // Initialize speech recognition
  const initSpeechRecognition = () => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      // @ts-ignore - TypeScript doesn't have built-in types for webkit prefixed APIs
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript + ' ';
        }
        setTranscript(currentTranscript.trim());
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        stopSpeechRecognition();
        setIsPushToTalkActive(false);
      };
      
      recognition.onend = () => {
        setIsPushToTalkActive(false);
      };
      
      return recognition;
    }
    return null;
  };

  // Start speech recognition
  const startSpeechRecognition = () => {
    if (!recognitionRef.current) {
      recognitionRef.current = initSpeechRecognition();
    }
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        return true;
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        return false;
      }
    } else {
      console.error('Speech recognition is not supported in this browser');
      return false;
    }
  };

  // Stop speech recognition
  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors on unmount
        }
      }
    };
  }, []);

  // Handle hand raise via RPC
  const handleHandRaiseClick = async () => {
    try {
      if (!agentServiceClient) {
        console.error('Agent RPC service client not initialized');
        return;
      }

      setIsHandRaised(!isHandRaised);
      
      // Create request payload
      const request = FrontendButtonClickRequest.create({
        buttonId: "hand_raise_button",
        customData: JSON.stringify({
          action: isHandRaised ? "hand_lower" : "hand_raise",
          user: userName,
          timestamp: new Date().toISOString()
        })
      });
      
      console.log('Sending hand raise RPC request:', request);
      
      // Send RPC request
      const response = await agentServiceClient.HandleFrontendButton(request);
      console.log('Hand raise RPC response:', response);
      
    } catch (error) {
      console.error('Error calling hand raise RPC:', error);
      // Revert state if there was an error
      setIsHandRaised(isHandRaised);
    }
  };

  // Handle push to talk via RPC
  const handlePushToTalkMouseDown = async () => {
    try {
      if (!agentServiceClient) {
        console.error('Agent RPC service client not initialized');
        return;
      }
      
      setIsPushToTalkActive(true);
      
      // Starting push-to-talk - initialize speech recognition
      const started = startSpeechRecognition();
      if (!started) {
        // If speech recognition failed to start
        setIsPushToTalkActive(false);
        return;
      }

      // Send initial push-to-talk activation request
      const startRequest = FrontendButtonClickRequest.create({
        buttonId: "push_to_talk_button",
        customData: JSON.stringify({
          action: "push_to_talk_start",
          user: userName,
          timestamp: new Date().toISOString()
        })
      });
      
      console.log('Sending push-to-talk start RPC request:', startRequest);
      await agentServiceClient.HandleFrontendButton(startRequest);
      
    } catch (error) {
      console.error('Error activating push-to-talk:', error);
      stopSpeechRecognition();
      setIsPushToTalkActive(false);
    }
  };

  const handlePushToTalkMouseUp = async () => {
    try {
      if (!agentServiceClient) {
        console.error('Agent RPC service client not initialized');
        return;
      }
      
      setIsPushToTalkActive(false);
      stopSpeechRecognition();
      
      // Only send the request if we have a transcript
      if (transcript.trim()) {
        setIsProcessing(true);
        
        const endRequest = FrontendButtonClickRequest.create({
          buttonId: "push_to_talk_end",
          customData: JSON.stringify({
            action: "push_to_talk_end",
            user: userName,
            timestamp: new Date().toISOString(),
            transcript: transcript.trim(),
            session_id: room.name // Using room name as session ID
          })
        });
        
        console.log('Sending push-to-talk end RPC request with transcript:', endRequest);
        
        const response = await agentServiceClient.HandleFrontendButton(endRequest);
        console.log('Push-to-talk transcript RPC response:', response);
        
        // Handle doubt response
        if (response?.dataPayload) {
          try {
            const doubtResponse = JSON.parse(response.dataPayload);
            
            // Call callback if provided
            if (onDoubtResponse) {
              onDoubtResponse(doubtResponse);
            }
            
          } catch (error) {
            console.error('Error processing doubt response payload:', error);
          }
        }
        
        // Clear transcript after sending
        setTranscript('');
        setIsProcessing(false);
      } else {
        console.log('No transcript to send');
      }
      
    } catch (error) {
      console.error('Error deactivating push-to-talk:', error);
      setIsProcessing(false);
    }
  };

  return (
    <div className={`interaction-controls flex gap-4 ${className}`}>
      {/* Hand Raise Button */}
      <button
        className={`hand-raise-btn rounded-full p-3 transition-colors ${
          isHandRaised 
            ? 'bg-amber-500 text-white hover:bg-amber-600' 
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
        onClick={handleHandRaiseClick}
        aria-label={isHandRaised ? 'Lower hand' : 'Raise hand'}
        title={isHandRaised ? 'Lower hand' : 'Raise hand'}
      >
        <HandMetal size={20} />
      </button>

      {/* Push-to-Talk Button */}
      <button
        className={`push-to-talk-btn rounded-full p-3 transition-colors ${
          isPushToTalkActive || isProcessing
            ? 'bg-blue-500 text-white hover:bg-blue-600'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
        onMouseDown={handlePushToTalkMouseDown}
        onMouseUp={handlePushToTalkMouseUp}
        onMouseLeave={() => isPushToTalkActive && handlePushToTalkMouseUp()}
        onTouchStart={handlePushToTalkMouseDown}
        onTouchEnd={handlePushToTalkMouseUp}
        disabled={isProcessing}
        aria-label={isPushToTalkActive ? 'Release to send' : 'Hold to speak'}
        title={isPushToTalkActive ? 'Release to send' : 'Hold to speak'}
      >
        {isPushToTalkActive ? <Mic size={20} /> : <MicOff size={20} />}
      </button>
      
      {/* Transcript display */}
      {(isPushToTalkActive || isProcessing) && (
        <div className="transcript-display ml-2 text-sm flex items-center">
          {isPushToTalkActive && transcript && (
            <span className="text-blue-600">{transcript}</span>
          )}
          {isPushToTalkActive && !transcript && (
            <span className="text-gray-500 animate-pulse">Listening...</span>
          )}
          {isProcessing && (
            <span className="text-amber-600 animate-pulse">Processing...</span>
          )}
        </div>
      )}
    </div>
  );
};

export default InteractionControlsWithRpc;
