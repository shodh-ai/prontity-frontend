'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Track, Room, RoomEvent } from 'livekit-client';
import { 
  useTracks, 
  useParticipants, 
  RoomContext,
  RoomAudioRenderer 
} from '@livekit/components-react';

interface SimpleTavusDisplayProps {
  room: Room;
}

export default function SimpleTavusDisplay({ room }: SimpleTavusDisplayProps) {
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
      {/* This component handles audio output from remote participants */}
      <RoomAudioRenderer />
      
      <div style={{ margin: '10px 0', display: 'flex', gap: '10px' }}>
        {micInitialized ? 
          <div style={{ 
            padding: '5px 10px',
            backgroundColor: '#4caf50', 
            color: 'white', 
            borderRadius: '4px',
            display: 'inline-block',
            fontSize: '12px'
          }}>Microphone initialized ✓</div> : 
          <div style={{ 
            padding: '5px 10px',
            backgroundColor: '#f44336', 
            color: 'white', 
            borderRadius: '4px',
            display: 'inline-block',
            fontSize: '12px'
          }}>Microphone not initialized</div>
        }
        
        {micActive ? 
          <div style={{ 
            padding: '5px 10px',
            backgroundColor: '#2196f3', 
            color: 'white', 
            borderRadius: '4px',
            display: 'inline-block',
            fontSize: '12px'
          }}>Microphone active ✓</div> : 
          <div style={{ 
            padding: '5px 10px',
            backgroundColor: '#ff9800', 
            color: 'white', 
            borderRadius: '4px',
            display: 'inline-block',
            fontSize: '12px'
          }}>Microphone not active</div>
        }
        
        {micError && 
          <div style={{ 
            padding: '5px 10px',
            backgroundColor: '#f44336', 
            color: 'white', 
            borderRadius: '4px',
            display: 'inline-block',
            fontSize: '12px'
          }}>{micError}</div>
        }
        
        <button 
          onClick={enableMicrophone}
          style={{ 
            padding: '5px 10px',
            backgroundColor: '#673ab7', 
            color: 'white', 
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Reconnect Mic
        </button>
      </div>
      
      <TavusRenderer />
    </RoomContext.Provider>
  );
}

function TavusRenderer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isAttached, setIsAttached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPlayButton, setShowPlayButton] = useState(false);
  
  // Get all participants and find the tavus avatar participant
  const participants = useParticipants();
  const tavusParticipant = participants.find(p => p.identity === 'tavus-avatar-agent');
  
  // Get all remote video AND audio tracks
  const videoTracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
    ],
    { 
      onlySubscribed: true,
      updateOnlyOn: [RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed]
    }
  );
  
  // Also subscribe to audio tracks from the avatar
  const audioTracks = useTracks(
    [
      { source: Track.Source.Microphone, withPlaceholder: false },
    ],
    { 
      onlySubscribed: true,
      updateOnlyOn: [RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed]
    }
  );
  
  // Filter for just the tavus avatar tracks
  const tavusTracks = videoTracks.filter(
    track => track.participant?.identity === 'tavus-avatar-agent' && 
             track.publication.kind === Track.Kind.Video
  );
  
  // Debugging info
  useEffect(() => {
    console.log("SimpleTavusDisplay: Rendering component");
    console.log("Participants:", participants.map(p => p.identity));
    console.log("Tavus participant found:", tavusParticipant ? tavusParticipant.identity : 'Not found');
    console.log("Total video tracks:", videoTracks.length);
    console.log("Tavus video tracks:", tavusTracks.length);
    
    if (tavusTracks.length > 0) {
      console.log("Tavus track details:", {
        sid: tavusTracks[0].publication.trackSid,
        name: tavusTracks[0].publication.trackName,
        kind: tavusTracks[0].publication.kind,
        source: tavusTracks[0].publication.source,
        isSubscribed: tavusTracks[0].publication.isSubscribed,
      });
    }
  }, [participants, videoTracks, tavusTracks]);
  
  // Attach the tavus video track to our video element
  useEffect(() => {
    if (tavusTracks.length === 0 || !videoRef.current) {
      return;
    }
    
    const tavusTrack = tavusTracks[0];
    
    if (!tavusTrack.publication.isSubscribed || !tavusTrack.publication.track) {
      setError("Track is not subscribed or track object is not available");
      return;
    }
    
    try {
      // Detach from any previous elements
      tavusTrack.publication.track.detach();
      
      // Attach to our video element with explicit logging
      console.log("Attaching Tavus track to video element...");
      tavusTrack.publication.track.attach(videoRef.current);
      console.log("Track attached successfully");
      setIsAttached(true);
      
      // Try to play the video with explicit error handling
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log("Video playback started automatically");
            setShowPlayButton(false);
          })
          .catch(err => {
            console.warn("Autoplay failed, showing play button:", err);
            setShowPlayButton(true);
            setError("Autoplay failed - click play button to start video");
          });
      }
    } catch (err) {
      console.error("Error attaching track:", err);
      setError(`Failed to attach video: ${(err as Error).message}`);
    }
    
    return () => {
      // Cleanup on unmount
      if (tavusTrack.publication.track) {
        try {
          tavusTrack.publication.track.detach();
        } catch (err) {
          console.error("Error detaching track:", err);
        }
      }
    };
  }, [tavusTracks]);
  
  const handlePlayClick = () => {
    if (!videoRef.current) return;
    
    videoRef.current.play()
      .then(() => {
        console.log("Video playback started via button click");
        setShowPlayButton(false);
        setError(null);
      })
      .catch(err => {
        console.error("Play failed even after user interaction:", err);
        setError(`Play failed: ${err.message}`);
      });
  };

  return (
    <div style={{ 
      position: 'relative', 
      width: '100%', 
      height: '100%',
      minHeight: '240px', 
      backgroundColor: '#000',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      {tavusParticipant && tavusTracks.length > 0 ? (
        <>
          <video 
            ref={videoRef}
            autoPlay 
            playsInline
            muted={false}
            style={{ 
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          
          {showPlayButton && (
            <button
              onClick={handlePlayClick}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 100,
                padding: '12px 24px',
                backgroundColor: '#566FE9',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '16px'
              }}
            >
              Play Avatar Video
            </button>
          )}
          
          {/* Debug info overlay */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '8px',
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: 'white',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            {error ? (
              <div style={{ color: '#ff6b6b' }}>{error}</div>
            ) : (
              <div>
                {isAttached ? 'Track attached ✅' : 'Track not attached ❌'}<br />
                Tracks: {tavusTracks.length} · Participant: {tavusParticipant?.identity || 'unknown'}
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'white'
        }}>
          <div>Waiting for Tavus Avatar...</div>
          <div style={{ fontSize: '12px', marginTop: '8px', color: '#aaa' }}>
            (tavus-avatar-agent not found in room)
          </div>
        </div>
      )}
    </div>
  );
}
