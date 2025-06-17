'use client';

import React, { ReactNode } from 'react';
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
  timerDuration, // Added timerDuration here
  toggleAudio,
  toggleCamera,
  handleLeave,
  customControls,
  children
}: LiveKitSessionUIProps) {
  // Helper function to determine page-specific styles

  return (
    <div className={`livekit-session-ui-container page-type-${pageType}`}>
      <header>
        <h1>{sessionTitle}</h1>
        {userName && <p>User: {userName}</p>}
        {questionText && <p>Question: {questionText}</p>}
      </header>
      <main>
        {children}
      </main>
      <footer>
        <div className="controls">
          {!hideAudio && <button onClick={toggleAudio}>{audioEnabled ? 'Mute' : 'Unmute'}</button>}
          {!hideVideo && <button onClick={toggleCamera}>{videoEnabled ? 'Stop Camera' : 'Start Camera'}</button>}
          {showTimer && <TimerController room={null} initialDuration={timerDuration || 60} />}
          {customControls}
          <button onClick={handleLeave}>Leave Session</button>
        </div>
      </footer>
    </div>
  );
}
