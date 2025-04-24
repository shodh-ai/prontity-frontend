'use client';

import React, { useState } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Track, LocalParticipant, LocalTrackPublication } from 'livekit-client';

interface CustomControlsProps {
  onLeave?: () => void;
}

export default function CustomControls({ onLeave }: CustomControlsProps) {
  const { localParticipant } = useLocalParticipant();
  
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);

  const toggleMicrophone = async () => {
    if (!localParticipant) return;
    
    const micTrack = getTrackBySource(localParticipant, Track.Source.Microphone);
    
    if (micTrack) {
      // If mic track exists, toggle it
      if (micEnabled) {
        await micTrack.mute();
      } else {
        await micTrack.unmute();
      }
      setMicEnabled(!micEnabled);
    } else if (!micEnabled) {
      // If no mic track and not enabled, create one
      try {
        // Create and publish audio track
        await localParticipant.setMicrophoneEnabled(true);
        setMicEnabled(true);
      } catch (e) {
        console.error('Failed to publish audio track:', e);
      }
    }
  };

  const toggleCamera = async () => {
    if (!localParticipant) return;
    
    const cameraTrack = getTrackBySource(localParticipant, Track.Source.Camera);
    
    if (cameraTrack) {
      // If camera track exists, toggle it
      if (cameraEnabled) {
        await cameraTrack.mute();
      } else {
        await cameraTrack.unmute();
      }
      setCameraEnabled(!cameraEnabled);
    } else if (!cameraEnabled) {
      // If no camera track and not enabled, create one
      try {
        // Create and publish video track
        await localParticipant.setCameraEnabled(true);
        setCameraEnabled(true);
      } catch (e) {
        console.error('Failed to publish video track:', e);
      }
    }
  };

  const handleLeave = () => {
    if (onLeave) {
      onLeave();
    }
  };

  // Helper to get track by source
  const getTrackBySource = (
    participant: LocalParticipant,
    source: Track.Source
  ): LocalTrackPublication | undefined => {
    return Array.from(participant.trackPublications.values()).find(
      (pub: LocalTrackPublication) => pub.source === source
    );
  };

  return (
    <div className="custom-controls">
      <button
        className="custom-button"
        onClick={toggleMicrophone}
        aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path 
            d="M12 16C14.2091 16 16 14.2091 16 12V6C16 3.79086 14.2091 2 12 2C9.79086 2 8 3.79086 8 6V12C8 14.2091 9.79086 16 12 16Z" 
            stroke="#566FE9" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
          <path 
            d="M19 10V12C19 15.866 15.866 19 12 19M12 19C8.13401 19 5 15.866 5 12V10M12 19V22M8 22H16" 
            stroke="#566FE9" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </button>
      
      <button
        className="custom-button"
        onClick={toggleCamera}
        aria-label={cameraEnabled ? "Turn off camera" : "Turn on camera"}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path 
            d="M15 10L20 7V17L15 14M4 7H15V17H4C2.89543 17 2 16.1046 2 15V9C2 7.89543 2.89543 7 4 7Z" 
            stroke="#566FE9" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </button>
      
      <button
        className="custom-button"
        onClick={handleLeave}
        aria-label="Leave session"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path 
            d="M11 4H4C3.44772 4 3 4.44772 3 5V19C3 19.5523 3.44772 20 4 20H11M16 16L21 12M21 12L16 8M21 12H9" 
            stroke="#566FE9" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
