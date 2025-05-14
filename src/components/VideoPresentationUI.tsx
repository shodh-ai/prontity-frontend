'use client';

import React from 'react';
import { Track } from 'livekit-client';
import '../styles/video-tiles.css';

interface VideoPresentationUIProps {
  userTrack: {
    publication?: {
      kind: string;
      track?: any;
      trackSid?: string;
      source?: string;
    };
    participant?: {
      identity: string;
    };
  } | null;
  aiTrack: {
    publication?: {
      kind: string;
      track?: any;
      trackSid?: string;
      source?: string;
    };
    participant?: {
      identity: string;
    };
  } | null;
  userName?: string;
  isAiConnected?: boolean;
  isUserConnected?: boolean;
  customLabels?: {
    userLabel?: string;
    aiLabel?: string;
  };
}

export default function VideoPresentationUI({
  userTrack,
  aiTrack,
  userName = 'User',
  isAiConnected = false,
  isUserConnected = false,
  customLabels = {
    userLabel: 'Your Camera',
    aiLabel: 'Tavus Avatar'
  }
}: VideoPresentationUIProps) {
  return (
    <div className="video-container">
      {/* User Participant Tile */}
      <div className="user-tile">
        {userTrack && userTrack.publication && userTrack.publication.kind === 'video' ? (
          <video 
            className="video-element"
            ref={el => {
              if (el && userTrack.publication && userTrack.publication.track) {
                userTrack.publication.track.attach(el);
              }
            }}
            autoPlay 
            playsInline
            muted
          />
        ) : (
          <div className="placeholder-bg user-bg">
            {isUserConnected ? (
              <div className="connecting-message">Starting camera...</div>
            ) : (
              <div className="placeholder-content">
                <div className="placeholder-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="5" width="15" height="14" rx="2" stroke="#888888" strokeWidth="2" />
                    <path d="M22 7l-5 5 5 5V7z" stroke="#888888" strokeWidth="2" />
                  </svg>
                </div>
                <div className="placeholder-text">Camera Off</div>
              </div>
            )}
          </div>
        )}
        <div className="user-label">{customLabels.userLabel}</div>
      </div>
      
      {/* AI Participant Tile */}
      <div className="ai-tile">
        {aiTrack && aiTrack.publication ? (
          <>
            <video 
              className="video-element"
              ref={el => {
                if (el && aiTrack.publication && aiTrack.publication.track) {
                  try {
                    aiTrack.publication.track.attach(el);
                  } catch (err) {
                    console.error('Error attaching AI track:', err);
                  }
                }
              }}
              autoPlay 
              playsInline
              controls={false}
              style={{ objectFit: 'cover' }}
            />
            {process.env.NODE_ENV === 'development' && (
              <div className="video-debug-info">
                Track ID: {aiTrack.publication.trackSid}<br/>
                Source: {aiTrack.publication.source}
              </div>
            )}
          </>
        ) : (
          <div className="placeholder-bg ai-bg">
            {isAiConnected ? (
              <div className="connecting-message">Connecting AI assistant...</div>
            ) : (
              <div className="placeholder-content">
                <div className="placeholder-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="#888888" strokeWidth="2" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="#888888" strokeWidth="2" />
                    <circle cx="9" cy="9" r="1" fill="#888888" />
                    <circle cx="15" cy="9" r="1" fill="#888888" />
                  </svg>
                </div>
                <div className="placeholder-text">AI Assistant Not Connected</div>
              </div>
            )}
          </div>
        )}
        <div className="ai-label">{customLabels.aiLabel}</div>
      </div>
    </div>
  );
}
