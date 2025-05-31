'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Track, Room, RoomEvent } from 'livekit-client';
import { 
  useTracks, 
  useParticipants, 
  RoomContext,
  RoomAudioRenderer 
} from '@livekit/components-react';

interface AudioHandlerProps {
  room: Room;
}

export default function AudioHandler({ room }: AudioHandlerProps) {
  const [micInitialized, setMicInitialized] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [micHeartbeat, setMicHeartbeat] = useState<NodeJS.Timeout | null>(null);
  
  // Function to enable microphone and publish to room
  const enableMicrophone = async () => {
    try {
      if (!room || !room.localParticipant) {
        setMicError('Room not connected');
        return;
      }
      
      console.log('Enabling microphone for LiveKit room...');
      
      // This is the key part - actually publish the microphone track to the room
      await room.localParticipant.setMicrophoneEnabled(true);
      console.log('Microphone enabled and published to room!');
      setMicActive(true);
      setMicError(null);
      
      // Set up a heartbeat to ensure microphone stays connected
      if (!micHeartbeat) {
        const heartbeatInterval = setInterval(async () => {
          console.log('Microphone heartbeat check...');
          if (room && !room.localParticipant.isMicrophoneEnabled) {
            console.log('Microphone heartbeat - reconnecting microphone');
            try {
              await room.localParticipant.setMicrophoneEnabled(true);
              setMicActive(true);
            } catch (err) {
              console.error('Failed to reconnect microphone in heartbeat:', err);
              setMicActive(false);
            }
          }
        }, 5000); // Check every 5 seconds
        
        setMicHeartbeat(heartbeatInterval);
      }
    } catch (error) {
      console.error('Failed to enable microphone:', error);
      setMicError(`Error: ${(error as Error).message}`);
      setMicActive(false);
    }
  };
  
  // Initialize microphone 
  useEffect(() => {
    console.log('Initializing microphone...');
    
    // Request microphone permission explicitly
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        console.log('Microphone permission granted, stream tracks:', stream.getTracks().length);
        setMicInitialized(true);
        
        // Create a temporary audio context to ensure browser allows audio
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Resume the audio context
        if (audioContext.state === 'suspended') {
          audioContext.resume().then(() => {
            console.log('Audio context resumed');
          });
        }
        
        // Stop the local tracks as LiveKit will manage them
        stream.getTracks().forEach(track => track.stop());
        
        // Enable microphone after initialization
        enableMicrophone();
      })
      .catch(err => {
        console.error('Error getting microphone permission:', err);
        setMicError(`Permission error: ${err.message}`);
      });
      
    // Cleanup when component unmounts
    return () => {
      if (micHeartbeat) {
        clearInterval(micHeartbeat);
      }
    };
  }, [room]);
  
  return (
    <RoomContext.Provider value={room}>
      <RoomAudioRenderer />
    </RoomContext.Provider>
  );
}
