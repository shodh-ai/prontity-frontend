'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Track, Room, RoomEvent } from 'livekit-client';
import { 
  useTracks, 
  useParticipants, 
  RoomContext
} from '@livekit/components-react';

interface SimpleTavusDisplayProps {
  room: Room;
}

export default function SimpleTavusDisplay({ room }: SimpleTavusDisplayProps) {
  // Video references and state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isAttached, setIsAttached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPlayButton, setShowPlayButton] = useState(false);
  
  // Handle play button click
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
  
  // Wrap the main content with RoomContext.Provider
  return (
    <RoomContext.Provider value={room}>
      <AvatarDisplay 
        videoRef={videoRef}
        isAttached={isAttached}
        setIsAttached={setIsAttached}
        error={error}
        setError={setError}
        showPlayButton={showPlayButton}
        setShowPlayButton={setShowPlayButton}
        handlePlayClick={handlePlayClick}
      />
    </RoomContext.Provider>
  );
}

// Internal component that uses LiveKit hooks
function AvatarDisplay({ 
  videoRef,
  isAttached,
  setIsAttached,
  error,
  setError,
  showPlayButton,
  setShowPlayButton,
  handlePlayClick
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  isAttached: boolean;
  setIsAttached: (isAttached: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  showPlayButton: boolean;
  setShowPlayButton: (showPlayButton: boolean) => void;
  handlePlayClick: () => void;
}) {
  // Use LiveKit hooks to get participants and tracks
  const participants = useParticipants();
  const videoTracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: false },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);
  
  // Filter for the tavus participant
  const tavusParticipant = participants.find(
    p => p.identity === 'tavus-avatar-agent'
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
    console.log("Available tracks:", videoTracks.length);
    console.log("Tavus tracks found:", tavusTracks.length);
    
    if (tavusTracks.length > 0) {
      // Debug more detailed info about the track
      console.log("First tavus track details:", {
        trackSid: tavusTracks[0].trackSid,
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
      setError("Track not subscribed or available");
      return;
    }
    
    try {
      // Detach first in case it's already attached
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
  


  // Return the Avatar Video component
  return (
    <div style={{ 
      position: 'relative', 
      width: '100%', 
      height: '100%',
      backgroundColor: '#000',
      overflow: 'hidden'
    }}>
      <div style={{ 
        position: 'relative', 
        width: '100%', 
        height: '100%'
      }}>
        <video 
          ref={videoRef}
          autoPlay 
          playsInline
          muted={false}
          style={{ 
            width: '100%',
            height: '100%',
            objectFit: 'cover'
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
        
        {/* Small status indicator */}
        <div style={{
          position: 'absolute',
          bottom: 4,
          right: 4,
          padding: '2px 6px',
          backgroundColor: error ? 'rgba(255,50,50,0.8)' : (isAttached ? 'rgba(0,180,0,0.6)' : 'rgba(0,0,0,0.6)'),
          color: 'white',
          fontSize: '10px',
          fontFamily: 'monospace',
          borderRadius: '4px'
        }}>
          {error ? '⚠️' : (isAttached ? '✓' : '○')}
        </div>
      </div>
    </div>
  );
}
