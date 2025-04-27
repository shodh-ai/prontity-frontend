'use client';

import React, { useState } from 'react';

interface VocabControlsProps {
  onLeave?: () => void;
}

export default function VocabControls({ onLeave }: VocabControlsProps) {
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  
  // Simple toggle functions that don't depend on LiveKit
  const toggleMicrophone = () => {
    setMicEnabled(!micEnabled);
  };
  
  const toggleCamera = () => {
    setCameraEnabled(!cameraEnabled);
  };
  
  const handleLeave = () => {
    if (onLeave) {
      onLeave();
    }
  };

  return (
    <div className="custom-controls">
      <button
        className={`custom-button ${micEnabled ? 'active' : ''}`}
        onClick={toggleMicrophone}
        aria-label="Microphone"
        title="Microphone"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 14C13.66 14 15 12.66 15 11V5C15 3.34 13.66 2 12 2C10.34 2 9 3.34 9 5V11C9 12.66 10.34 14 12 14Z" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M19 11C19 15.97 15.19 20 12 20M12 20C8.81 20 5 15.97 5 11M12 20V23M8 23H16" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      
      <button
        className={`custom-button ${cameraEnabled ? 'active' : ''}`}
        onClick={toggleCamera}
        aria-label="Camera"
        title="Camera"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 10L20 7V17L15 14M4 7H15V17H4C2.89543 17 2 16.1046 2 15V9C2 7.89543 2.89543 7 4 7Z" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      
      <button
        className="custom-button"
        onClick={handleLeave}
        aria-label="Edit"
        title="Edit"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11 4H4C2.9 4 2 4.9 2 6V20C2 21.1 2.9 22 4 22H18C19.1 22 20 21.1 20 20V13" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M18.5 2.5C19.3 3.3 19.3 4.7 18.5 5.5L12 12L8 13L9 9L15.5 2.5C16.3 1.7 17.7 1.7 18.5 2.5Z" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}
