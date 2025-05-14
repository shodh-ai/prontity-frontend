'use client';

import React, { useEffect, useState, useContext } from 'react';
import { useTracks, useParticipants, RoomContext } from '@livekit/components-react';
import { Track, Room, RemoteTrackPublication, LocalTrackPublication } from 'livekit-client';
import '../styles/video-tiles.css';

interface AvatarVideoDisplayProps {
  userName?: string;
  showUserVideo?: boolean;
  showAvatarVideo?: boolean;
  room: Room; // We need the room instance
}

export default function AvatarVideoDisplay({ 
  userName = 'TestUser', 
  showUserVideo = true,
  showAvatarVideo = true,
  room
}: AvatarVideoDisplayProps) {
  // Note: We need to wrap our component body in a RoomContext.Provider
  // to make the LiveKit hooks work properly
  return (
    <RoomContext.Provider value={room}>
      <VideoContent 
        userName={userName} 
        showUserVideo={showUserVideo}
        showAvatarVideo={showAvatarVideo}
      />
    </RoomContext.Provider>
  );
}

// This inner component can use LiveKit hooks since it's wrapped in RoomContext
function VideoContent({ 
  userName = 'TestUser',
  showUserVideo = true,
  showAvatarVideo = true
}: {
  userName?: string;
  showUserVideo?: boolean;
  showAvatarVideo?: boolean;
}) {
  const participants = useParticipants();
  
  // Get all tracks including camera and avatar
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );
  
  // Log participant and track information
  useEffect(() => {
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
  }, [tracks, participants]);
  
  // Enhanced debugging for participants
  useEffect(() => {
    // Log all participants whenever they change
    console.log('AvatarVideoDisplay: All participants', {
      total: participants.length,
      identities: participants.map(p => p.identity),
      hasLocalParticipant: participants.some(p => p.isLocal),
      hasRemoteParticipants: participants.some(p => !p.isLocal),
    });
  }, [participants]);
  
  // PRIORITY IDENTIFICATION: Find avatar participant
  // 1. Find the tavus-avatar-agent participant specifically (highest priority)
  const tavusParticipant = participants.find(p => 
    p.identity === 'tavus-avatar-agent'
  );

  // 2. Find the simulated agent participant as fallback
  const simulatedParticipant = participants.find(p => 
    p.identity.includes('simulated-agent')
  );

  // 3. Find any AI participant as second fallback
  const aiParticipant = participants.find(p => 
    p.identity.includes('ai') || p.identity.includes('assistant')
  );

  // 4. Find the user participant
  const userParticipant = participants.find(p => 
    p.identity === userName || p.identity.includes('User')
  );
  
  // Track connection state for better debugging
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  
  // Get room instance from context
  const room = useContext(RoomContext);
  
  // Log when connection state changes
  useEffect(() => {
    try {
      if (!room) {
        console.error('Room instance not available for connection state tracking');
        return;
      }
      
      // Setup room connection state listener
      const handleConnectionStateChange = (state: string) => {
        console.log(`Room connection state changed to: ${state}`);
        setConnectionState(state);
      };
      
      // Add event listener for connection state change
      room.on('connectionStateChanged', handleConnectionStateChange);
      
      // Set initial state based on the room's state
      // LiveKit Room uses a state property not connectionState
      if (room.state) {
        setConnectionState(room.state);
      }
      
      // Return cleanup function
      return () => {
        room.off('connectionStateChanged', handleConnectionStateChange);
      };
    } catch (err) {
      console.error('Error setting up connection state tracking:', err);
    }
  }, [room]);
  
  // Log when we find the avatar participant
  useEffect(() => {
    try {
      if (tavusParticipant) {
        console.log('✅ FOUND TAVUS AVATAR PARTICIPANT!', tavusParticipant.identity);
        // Log track information directly without conversion to array
        console.log('Tavus tracks count:', tavusParticipant.trackPublications.size);
        
        // Loop through tracks manually to avoid TypeScript issues
        const trackInfo: any[] = [];
        tavusParticipant.trackPublications.forEach((track) => {
          trackInfo.push({
            kind: track.kind,
            source: track.source,
            trackName: track.trackName,
            isEnabled: track.isEnabled,
            isMuted: track.isMuted
          });
        });
        console.log('Tavus track details:', trackInfo);
      } else if (simulatedParticipant) {
        console.log('✅ FOUND SIMULATED AGENT PARTICIPANT!', simulatedParticipant.identity);
      } else if (aiParticipant) {
        console.log('✅ FOUND AI PARTICIPANT!', aiParticipant.identity);
      } else {
        console.log('⚠️ No avatar participants found yet. Room state:', connectionState, 'Participants:', participants.length);
      }
    } catch (err) {
      console.error('Error in avatar participant detection:', err);
    }
  }, [tavusParticipant, simulatedParticipant, aiParticipant, participants, connectionState]);
  
  // FIND TRACKS by directly searching for each participant's tracks
  // 1. Get all video tracks from the tavus participant
  const tavusVideoTracks = tracks.filter(track => 
    track.participant?.identity === 'tavus-avatar-agent' && 
    track.publication?.kind === 'video'
  );
  
  // 2. Get all video tracks from any simulated agent
  const simulatedVideoTracks = tracks.filter(track => 
    track.participant?.identity?.includes('simulated') && 
    track.publication?.kind === 'video'
  );
  
  // 3. Get all video tracks from any AI-like participant (broader matching)
  const aiVideoTracks = tracks.filter(track => {
    if (!track.participant || track.publication?.kind !== 'video') return false;
    const identity = track.participant.identity;
    return identity.includes('ai') || 
           identity.includes('assistant') || 
           identity.includes('agent') || 
           identity === 'tavus-avatar-agent';
  });
  
  // 3. Get all video tracks from the user participant
  const userVideoTracks = tracks.filter(track => {
    if (!track.participant || track.publication?.kind !== 'video') return false;
    return track.participant.identity === userName || 
           track.participant.identity.includes('User');
  });
  
  // Prioritized selection of tracks for the AI and user tiles
  
  // For the AI tile - find the correct track based on priorities
  let aiTrack = null;
  
  // Log all possible video tracks for debugging
  console.log('Available video tracks:', {
    tavusVideoTracks: tavusVideoTracks.length,
    simulatedVideoTracks: simulatedVideoTracks.length,
    aiVideoTracks: aiVideoTracks.length,
    allVideoTracks: tracks.filter(t => t.publication?.kind === 'video').length
  });
  
  // Check for any video tracks from all participants if we're having trouble finding specific ones
  const allVideoTracks = tracks.filter(t => t.publication?.kind === 'video');
  
  if (tavusVideoTracks.length > 0) {
    aiTrack = tavusVideoTracks[0];
    console.log('Using Tavus avatar video track');
  } else if (simulatedVideoTracks.length > 0) {
    aiTrack = simulatedVideoTracks[0];
    console.log('Using simulated agent video track');
  } else if (aiVideoTracks.length > 0) {
    aiTrack = aiVideoTracks[0];
    console.log('Using AI video track');
  } else if (allVideoTracks.length > 0) {
    // Fall back to any video track if we can't find specific ones
    aiTrack = allVideoTracks[0];
    console.log('Using fallback video track from:', allVideoTracks[0].participant?.identity);
  }
  
  // For the user tile - use only tracks from the user participant
  let userTrack = null;
  
  if (userVideoTracks.length > 0) {
    userTrack = userVideoTracks[0];
    console.log('Using user video track');
  }
  
  // Determine connection state for UI feedback
  const isAiConnected = !!tavusParticipant || !!simulatedParticipant || !!aiParticipant;
  const isUserConnected = !!userParticipant;
  
  return (
    <div className="video-container">
      {/* User Participant Tile */}
      {showUserVideo && (
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
          <div className="user-label">Your Camera</div>
        </div>
      )}
      
      {/* AI Participant Tile */}
      {showAvatarVideo && (
        <div className="ai-tile">
          {aiTrack && aiTrack.publication ? (
            <>
              {/* Key additional attribute to force re-render when track changes */}
              <video 
                key={`video-${aiTrack.publication.trackSid}`}
                className="video-element"
                ref={el => {
                  if (el && aiTrack.publication && aiTrack.publication.track) {
                    try {
                      console.log('Attaching avatar video track to element:', aiTrack.publication.trackSid);
                      
                      // Clean up existing tracks first
                      const mediaStream = el.srcObject as MediaStream;
                      if (mediaStream) {
                        mediaStream.getTracks().forEach(track => track.stop());
                      }
                      
                      // Make sure element is visible before attaching
                      el.style.width = '100%';
                      el.style.height = '100%';
                      el.style.objectFit = 'cover'; // Cover works better for avatar video
                      el.style.display = 'block';
                      el.style.visibility = 'visible';
                      el.style.backgroundColor = '#111'; // Dark background for visibility
                      el.style.borderRadius = '0'; // Ensure no border radius cuts off content
                      
                      // Log media track information before attaching
                      console.log('About to attach track:', {
                        trackId: aiTrack.publication.trackSid,
                        kind: aiTrack.publication.kind,
                        source: aiTrack.publication.source,
                        name: aiTrack.publication.trackName,
                        enabled: aiTrack.publication.isEnabled,
                        muted: aiTrack.publication.isMuted,
                      });
                      
                      // Attach with explicit options
                      const attachOptions = { audioOutput: 'default' };
                      aiTrack.publication.track.attach(el);
                      
                      // Ensure audio settings
                      el.muted = false;
                      el.volume = 1.0;
                      
                      // Force reload the video element
                      el.load();
                      
                      // Create a timeout to check if video is actually playing
                      setTimeout(() => {
                        if (el.readyState < 1) {
                          console.warn('Video not playing after 1 second, forcing play');
                          el.play().catch(playErr => {
                            console.error('Forced play error:', playErr);
                          });
                        } else {
                          console.log('Video is playing successfully');
                        }
                      }, 1000);
                      
                      // Try to autoplay immediately
                      const playPromise = el.play();
                      if (playPromise !== undefined) {
                        playPromise.catch(err => {
                          console.warn('Autoplay failed, may need user interaction:', err);
                          // Create an obvious play button
                          const parent = el.parentElement;
                          if (parent) {
                            const playButton = document.createElement('button');
                            playButton.innerText = 'Play Avatar Video';
                            playButton.style.position = 'absolute';
                            playButton.style.top = '50%';
                            playButton.style.left = '50%';
                            playButton.style.transform = 'translate(-50%, -50%)';
                            playButton.style.zIndex = '100';
                            playButton.style.padding = '12px 20px';
                            playButton.style.backgroundColor = '#566FE9';
                            playButton.style.color = 'white';
                            playButton.style.border = 'none';
                            playButton.style.borderRadius = '5px';
                            playButton.style.cursor = 'pointer';
                            playButton.style.fontWeight = 'bold';
                            playButton.onclick = () => {
                              el.muted = false;
                              el.play().catch(e => console.error('Play after click failed:', e));
                              playButton.remove();
                            };
                            parent.appendChild(playButton);
                          }
                        });
                      }
                    } catch (err) {
                      console.error('Error attaching AI track:', err);
                    }
                  } else {
                    console.warn('Missing element or track to attach:', {
                      hasElement: !!el,
                      hasPublication: !!aiTrack?.publication,
                      hasTrack: !!aiTrack?.publication?.track
                    });
                  }
                }}
                autoPlay={true}
                playsInline={true}
                muted={false}
                controls={false}
                style={{ 
                  objectFit: 'cover',
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  visibility: 'visible',
                  backgroundColor: '#111'
                }}
              />
              {/* Show debug info in all environments to help troubleshoot */}
              <div className="video-debug-info">
                Track ID: {aiTrack.publication.trackSid}<br/>
                Source: {aiTrack.publication.source}<br/>
                Type: {aiTrack.publication.kind}<br/>
                Identity: {aiTrack.participant?.identity}
              </div>
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
          <div className="ai-label">Tavus Avatar</div>
        </div>
      )}
    </div>
  );
}
