'use client';

import React, { ReactNode } from 'react';
import VideoControlsUI from './VideoControlsUI';
import TimerController from './TimerController';
import '../styles/livekit-session-ui.css';

export type PageType = 'speaking' | 'speakingpage' | 'writing' | 'vocab' | 'reflection' | 'rox' | 'login' | 'default';

interface LiveKitSessionUIProps {
  // Connection properties
  token: string;
  pageType?: PageType;
  sessionTitle?: string;
  questionText?: string;
  userName?: string;
  
  // UI state properties
  audioEnabled: boolean;
  videoEnabled: boolean;
  hideAudio?: boolean;
  hideVideo?: boolean;
  showTimer?: boolean;
  timerDuration?: number;
  
  // Event handlers
  toggleAudio: () => void;
  toggleCamera: () => void;
  handleLeave: () => void;
  
  // Additional components
  customControls?: ReactNode;
  children?: ReactNode;
}

export default function LiveKitSessionUI({
  token,
  pageType = 'default',
  sessionTitle = 'LiveKit Session',
  questionText,
  userName,
  audioEnabled,
  videoEnabled,
  hideAudio = false,
  hideVideo = false,
  showTimer = false,
  toggleAudio,
  toggleCamera,
  handleLeave,
  customControls,
  children
}: LiveKitSessionUIProps) {
  // Helper function to determine page-specific styles
  const getPageSpecificClasses = () => {
    switch (pageType) {
      case 'speaking':
        return 'speaking-page-container';
      case 'writing':
        return 'writing-page-container';
      case 'vocab':
        return 'vocab-page-container';
      case 'reflection':
        return 'reflection-page-container';
      case 'rox':
        return 'rox-page-container';
      default:
        return 'default-page-container';
    }
  };

  return (
    <div className={`livekit-session-container ${getPageSpecificClasses()}`}>
      {/* Header with session title */}
      <div className="session-header">
        <h2 className="session-title">{sessionTitle}</h2>
        
        {/* Display connection status */}
        <div className="connection-status">
          <span className={`status-indicator ${token ? 'connected' : 'disconnected'}`}>
            {token ? 'Connected' : 'Connecting...'}
          </span>
        </div>
      </div>
      
      {/* Question display if provided */}
      {questionText && (
        <div className="question-container">
          <h3 className="question-label">Question:</h3>
          <p className="question-text">{questionText}</p>
        </div>
      )}
      
      {/* Timer display if enabled */}
      {showTimer && token && (pageType === 'speaking' || pageType === 'speakingpage') && (
        <div className="timer-container">
          <TimerController visible={true} />
        </div>
      )}
      
      {/* Main conference container - now only contains controls */}
      <div className="conference-container">
        {/* Video controls */}
        <VideoControlsUI
          audioEnabled={audioEnabled}
          videoEnabled={videoEnabled}
          toggleAudio={toggleAudio}
          toggleCamera={toggleCamera}
          handleLeave={handleLeave}
          hideAudio={hideAudio}
          hideVideo={hideVideo}
          customControls={customControls}
        />
      </div>
      
      {/* Additional content passed as children */}
      {children}
    </div>
  );
}
