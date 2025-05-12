'use client';

import React, { useEffect, useState } from 'react';
import { useTracks, useParticipants, ConnectionState, useConnectionState } from '@livekit/components-react';
import { Track, Participant, Room } from 'livekit-client';
import '../styles/video-tiles.css';

interface VideoTilesProps {
  userName?: string;
}

export default function VideoTiles({ userName = 'TestUser' }: VideoTilesProps = {}) {
  // Get connection state and participants
  const connectionState = useConnectionState();
  const participants = useParticipants();
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Get all tracks including camera and avatar
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );
  
  // Debug logs for room state
  useEffect(() => {
    console.log('Connection:', connectionState);
    console.log(`Participants (${participants.length}):`, participants.map(p => p.identity).join(', '));
    
    // Detailed participant and track logging
    participants.forEach(participant => {
      const participantTracks = tracks.filter(t => t.participant?.identity === participant.identity);
      console.log(`Participant ${participant.identity} has ${participantTracks.length} tracks:`, 
        participantTracks.map(t => ({
          kind: t.publication?.kind,
          source: t.publication?.source,
          trackName: t.publication?.trackName,
          trackSid: t.publication?.trackSid
        }))
      );
    });
    
    console.log(`Tracks (${tracks.length}):`, tracks.map(t => t.publication?.source).join(', '));
    console.log('Track kinds:', tracks.map(t => t.publication?.kind).join(', '));
    
    // Update debug info
    if (participants.length > 0) {
      const info = `Connection: ${connectionState}\n` +
                  `Participants (${participants.length}): ${participants.map(p => p.identity).join(', ')}\n` +
                  `Tracks (${tracks.length}): ${tracks.map(t => t.publication?.source).filter(Boolean).join(', ')}\n` +
                  `Track kinds: ${tracks.map(t => t.publication?.kind).filter(Boolean).join(', ')}\n`;
      setDebugInfo(info);
    }
  }, [tracks, participants, connectionState]);
  
  // SIMPLIFY: Direct identification of participant types
  // 1. Find the tavus-avatar-agent participant specifically
  const tavusParticipant = participants.find(p => 
    p.identity === 'tavus-avatar-agent'
  );

  // 2. Find the simulated agent participant
  const simulatedParticipant = participants.find(p => 
    p.identity.includes('simulated-agent')
  );

  // 3. Find any AI participant
  const aiParticipant = participants.find(p => 
    p.identity.includes('ai') || p.identity.includes('assistant')
  );

  // 4. Find the user participant
  const userParticipant = participants.find(p => 
    p.identity === userName || p.identity.includes('User')
  );

  console.log('Tavus participant found:', tavusParticipant ? tavusParticipant.identity : 'none');
  console.log('Simulated participant found:', simulatedParticipant ? simulatedParticipant.identity : 'none');
  console.log('AI participant found:', aiParticipant ? aiParticipant.identity : 'none');
  console.log('User participant found:', userParticipant ? userParticipant.identity : 'none');
  
  // FIND TRACKS by directly searching for each participant's tracks
  // 1. Get all video tracks from the tavus participant
  const tavusVideoTracks = tracks.filter(track => 
    track.participant?.identity === 'tavus-avatar-agent' && 
    track.publication?.kind === 'video'
  );
  
  // 2. Get all video tracks from any AI-like participant
  const aiVideoTracks = tracks.filter(track => {
    if (!track.participant || track.publication?.kind !== 'video') return false;
    const identity = track.participant.identity;
    return identity.includes('ai') || 
           identity.includes('assistant') || 
           identity.includes('simulated') || 
           identity === 'tavus-avatar-agent';
  });
  
  // 3. Get all video tracks from the user participant
  const userVideoTracks = tracks.filter(track => {
    if (!track.participant || track.publication?.kind !== 'video') return false;
    return track.participant.identity === userName || 
           track.participant.identity.includes('User');
  });
  
  console.log('Tavus video tracks:', tavusVideoTracks.length);
  console.log('AI video tracks:', aiVideoTracks.length);
  console.log('User video tracks:', userVideoTracks.length);
  
  // Prioritized selection of tracks for the AI and user tiles
  
  // For the AI tile - try multiple sources in order of preference
  let aiTrack = null;
  
  // 1. First priority: Use tavus-avatar-agent video track if available
  if (tavusVideoTracks.length > 0) {
    aiTrack = tavusVideoTracks[0];
    console.log('Using Tavus avatar video track');
  } 
  // 2. Second priority: Use any AI video track if available
  else if (aiVideoTracks.length > 0) {
    aiTrack = aiVideoTracks[0];
    console.log('Using AI video track from:', aiTrack.participant?.identity);
  }
  // 3. Final attempt: Use simulated agent's track if it exists
  else if (simulatedParticipant) {
    // Try to find any video track from the simulated participant
    const simulatedTrack = tracks.find(track => 
      track.participant?.identity === simulatedParticipant.identity && 
      track.publication?.kind === 'video'
    );
    
    if (simulatedTrack) {
      aiTrack = simulatedTrack;
      console.log('Using simulated agent video track');
    }
  }
  
  // Log AI track status
  console.log('Found AI track:', aiTrack ? `YES from ${aiTrack.participant?.identity}` : 'NO');
  
  // For the user tile - use only tracks from the user participant
  let userTrack = null;
  
  if (userVideoTracks.length > 0) {
    userTrack = userVideoTracks[0];
    console.log('Using user video track');
  }
  
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
        <div className="user-label">Your Camera</div>
      </div>
      
      {/* AI Participant Tile - Show any available video track */}
      <div className="ai-tile">
        {aiTrack && aiTrack.publication ? (
          <>
            <video 
              className="video-element"
              ref={el => {
                if (el && aiTrack.publication) {
                  console.log('Attaching AI video track:', aiTrack.publication.trackSid);
                  try {
                    // Force attach the track to the video element
                    const track = aiTrack.publication.track;
                    if (track) {
                      console.log('Track found, attaching...');
                      track.attach(el);
                      console.log('Track attached successfully');
                    } else {
                      console.log('Track is null or undefined');
                    }
                  } catch (err) {
                    console.error('Error attaching track:', err);
                  }
                }
              }}
              autoPlay 
              playsInline
              controls={false}
              style={{ objectFit: 'cover' }}
            />
            <div className="video-debug-info">
              Track ID: {aiTrack.publication.trackSid}<br/>
              Source: {aiTrack.publication.source}
            </div>
          </>
        ) : (
          <div className="no-track-message">
            <p>No AI video track available</p>
            <p className="details">
              Looking for tavus-avatar-agent video track...
              {tavusParticipant ? 'Found participant, but no video track' : 'Participant not found'}
            </p>
          </div>
        )}
        <div className="ai-label">Tavus Avatar</div>
      </div>
    </div>
  );
}
