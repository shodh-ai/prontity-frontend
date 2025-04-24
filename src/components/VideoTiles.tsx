'use client';

import React from 'react';
import { useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';
import '../styles/video-tiles.css';

export default function VideoTiles() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );
  
  // Find any AI track if available
  const aiTrack = tracks.find(track => {
    const identity = track.participant?.identity || '';
    return identity.includes('ai') || identity.includes('assistant');
  });
  
  // Find any user track if available
  const userTrack = tracks.find(track => {
    const identity = track.participant?.identity || '';
    return !identity.includes('ai') && !identity.includes('assistant');
  });
  
  return (
    <div className="video-container">
      {/* User Participant Tile */}
      <div className="user-tile">
        {userTrack && userTrack.publication && userTrack.publication.kind === 'video' ? (
          <video 
            className="video-element"
            ref={el => {
              if (el && userTrack.publication) {
                userTrack.publication.track?.attach(el);
              }
            }}
            autoPlay 
            playsInline
            muted
          />
        ) : (
          <div className="placeholder-bg user-bg" />
        )}
        <div className="user-label">User</div>
      </div>
      
      {/* AI Participant Tile */}
      <div className="ai-tile">
        {aiTrack && aiTrack.publication && aiTrack.publication.kind === 'video' ? (
          <video 
            className="video-element"
            ref={el => {
              if (el && aiTrack.publication) {
                aiTrack.publication.track?.attach(el);
              }
            }}
            autoPlay 
            playsInline
            muted
          />
        ) : (
          <div className="placeholder-bg ai-bg" />
        )}
        <div className="ai-label">AI Speaking Teacher</div>
      </div>
    </div>
  );
}
