'use client';

import React from 'react';
import '../styles/video-controls.css';

interface VideoControlsUIProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  toggleAudio: () => void;
  toggleCamera: () => void;
  handleLeave: () => void;
  hideAudio?: boolean;
  hideVideo?: boolean;
  customControls?: React.ReactNode;
}

export default function VideoControlsUI({
  audioEnabled,
  videoEnabled,
  toggleAudio,
  toggleCamera,
  handleLeave,
  hideAudio = false,
  hideVideo = false,
  customControls
}: VideoControlsUIProps) {
  return (
    <div className="custom-controls">
      {/* Microphone toggle button */}
      {!hideAudio && (
        <button 
          className="custom-button" 
          onClick={toggleAudio}
          style={{
            background: audioEnabled ? '#FFFFFF' : '#D7D7D7',
            border: audioEnabled ? '1px solid #566FE9' : '1px solid #888888'
          }}
          aria-label={audioEnabled ? "Mute microphone" : "Unmute microphone"}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" 
              stroke={audioEnabled ? '#566FE9' : '#888888'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" 
              stroke={audioEnabled ? '#566FE9' : '#888888'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {!audioEnabled && (
              <path d="M3 3l18 18" stroke="#FF0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </button>
      )}
      
      {/* Camera toggle button */}
      {!hideVideo && (
        <button 
          className="custom-button" 
          onClick={toggleCamera}
          style={{
            background: videoEnabled ? '#FFFFFF' : '#D7D7D7',
            border: videoEnabled ? '1px solid #566FE9' : '1px solid #888888'
          }}
          aria-label={videoEnabled ? "Turn off camera" : "Turn on camera"}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M23 7l-7 5 7 5V7z" stroke={videoEnabled ? '#566FE9' : '#888888'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" stroke={videoEnabled ? '#566FE9' : '#888888'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {!videoEnabled && (
              <path d="M3 3l18 18" stroke="#FF0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </button>
      )}

      {/* Custom controls can be injected here */}
      {customControls}

      {/* Leave session button */}
      <button 
        className="custom-button" 
        onClick={handleLeave}
        style={{
          background: '#FFFFFF',
          border: '1px solid #566FE9'
        }}
        aria-label="Leave session"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 17l5-5-5-5" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 12H9" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
