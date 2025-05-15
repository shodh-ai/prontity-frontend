'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Track, Room, RoomEvent } from 'livekit-client';
import { 
  useTracks, 
  useParticipants, 
  RoomContext,
  RoomAudioRenderer 
} from '@livekit/components-react';

interface FixedTavusDisplayProps {
  room: Room | null;
  style?: React.CSSProperties;
}

// This is a simplified version of TavusDisplay that only shows one "Waiting" message
export default function FixedTavusDisplay({ 
  room,
  style = {}
}: FixedTavusDisplayProps) {
  if (!room) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-black">
        <div className="text-white">Connecting to LiveKit room...</div>
      </div>
    );
  }

  return (
    <RoomContext.Provider value={room}>
      <TavusRenderer style={style} />
      <RoomAudioRenderer />
    </RoomContext.Provider>
  );
}

function TavusRenderer({ style = {} }: { style?: React.CSSProperties }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isAttached, setIsAttached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPlayButton, setShowPlayButton] = useState(false);
  
  // Safe access to participants and tracks from LiveKit room context
  // Using try-catch to handle potential errors with hooks
  let participants: any[] = [];
  let videoTracks: any[] = [];
  
  try {
    participants = useParticipants() || [];
  } catch (err) {
    console.error('Error getting participants:', err);
  }
  
  try {
    // The error is happening here, so wrap it safely
    const tracks = useTracks({
      source: Track.Source.Camera,
      onlySubscribed: true,
    });
    videoTracks = Array.isArray(tracks) ? tracks : [];
  } catch (err) {
    console.error('Error getting tracks:', err);
  }
  
  // Find the tavus avatar participant safely
  const tavusParticipant = Array.isArray(participants) ? 
    participants.find(p => p?.identity === 'tavus-avatar-agent') : 
    undefined;
  
  // Filter for just the tavus avatar tracks safely
  const tavusTracks = Array.isArray(videoTracks) ? 
    videoTracks.filter(track => 
      track?.participant?.identity === 'tavus-avatar-agent' && 
      track?.publication?.kind === Track.Kind.Video
    ) : 
    [];
  
  // Attach the tavus video track to our video element
  useEffect(() => {
    if (tavusTracks.length === 0 || !videoRef.current) {
      return;
    }
    
    const tavusTrack = tavusTracks[0];
    
    if (!tavusTrack.publication.isSubscribed || !tavusTrack.publication.track) {
      console.log("Track not subscribed, waiting...");
      return;
    }
    
    try {
      // Detach from any previous elements first
      tavusTrack.publication.track.detach();
      
      // Attach to our video element
      tavusTrack.publication.track?.attach(videoRef.current);
      setIsAttached(true);
      
      // Try to play the video
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setShowPlayButton(false);
          })
          .catch(err => {
            setShowPlayButton(true);
            setError("Click play button to start video");
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
        setShowPlayButton(false);
        setError(null);
      })
      .catch(err => {
        setError(`Play failed: ${err.message}`);
      });
  };

  return (
    <div style={{ 
      position: 'relative', 
      width: '100%', 
      height: '100%',
      backgroundColor: '#000',
      overflow: 'hidden',
      ...style
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
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-white">
          <div>Waiting for Tavus Avatar...</div>
          <div className="text-xs mt-2 text-gray-400">
            (tavus-avatar-agent not found in room)
          </div>
        </div>
      )}
    </div>
  );
}
