import React, { useEffect, useRef, useState } from 'react';
import { Track, RemoteParticipant, RemoteTrackPublication, TrackEvent } from 'livekit-client';

interface TestAvatarVideoDisplayProps {
  participant: RemoteParticipant | null;
}

export const TestAvatarVideoDisplay: React.FC<TestAvatarVideoDisplayProps> = ({ participant }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasAttached, setHasAttached] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<RemoteTrackPublication | null>(null);
  const [error, setError] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [showPlayButton, setShowPlayButton] = useState(false);

  useEffect(() => {
    // Reset state when participant changes
    setHasAttached(false);
    setCurrentTrack(null);
    setError('');
    setDebugInfo({});
    setShowPlayButton(false);
    
    if (!participant) {
      console.log('No participant provided');
      return;
    }
    
    console.log(`TestAvatarVideoDisplay: Participant ${participant.identity} provided`);
    
    // Log all tracks from this participant
    const trackPublications = Array.from(participant.trackPublications.values());
    console.log(`TestAvatarVideoDisplay: Participant has ${trackPublications.length} track publications:`, 
      trackPublications.map(t => ({ sid: t.trackSid, name: t.trackName, kind: t.kind, isSubscribed: t.isSubscribed })));
    
    // Find the video track
    const videoTrackPublications = trackPublications.filter(pub => pub.kind === Track.Kind.Video);
    console.log(`TestAvatarVideoDisplay: Found ${videoTrackPublications.length} video track publications`);
    
    if (videoTrackPublications.length === 0) {
      setError('No video tracks found for this participant');
      return;
    }
    
    // Take the first video track
    const videoTrack = videoTrackPublications[0];
    setCurrentTrack(videoTrack);
    
    // Log track details
    setDebugInfo({
      trackSid: videoTrack.trackSid,
      trackName: videoTrack.trackName,
      kind: videoTrack.kind,
      isSubscribed: videoTrack.isSubscribed,
      source: videoTrack.source,
      dimensions: videoTrack.dimensions ? 
        `${videoTrack.dimensions?.width}x${videoTrack.dimensions?.height}` : 'Unknown'
    });
    
    // Subscribe to track changes
    const handleSubscribedChanged = (track: Track) => {
      console.log(`TestAvatarVideoDisplay: Track subscription changed, isSubscribed: ${videoTrack.isSubscribed}`);
      
      if (!videoTrack.isSubscribed || !videoTrack.track) {
        setHasAttached(false);
        setError('Track is not subscribed');
        return;
      }
      
      if (!videoRef.current) {
        setError('Video element not found');
        return;
      }
      
      try {
        // Detach from all elements first
        track.detach();
        
        // Attach to our video element
        track.attach(videoRef.current);
        setHasAttached(true);
        console.log('TestAvatarVideoDisplay: Successfully attached track to video element');
        
        // Try to play the video
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('TestAvatarVideoDisplay: Video playback started successfully');
              setShowPlayButton(false);
            })
            .catch(e => {
              console.error('TestAvatarVideoDisplay: Error playing video:', e);
              setShowPlayButton(true);
              setError(`Autoplay failed: ${e.message}. Click play button to start manually.`);
            });
        }
      } catch (e) {
        console.error('TestAvatarVideoDisplay: Error attaching track:', e);
        setError(`Error attaching track: ${(e as Error).message}`);
      }
    };
    
    // Handle track subscription
    if (videoTrack.isSubscribed && videoTrack.track) {
      handleSubscribedChanged(videoTrack.track);
    }
    
    const onTrackSubscribed = (track: Track) => { // The 'track' argument here is the actual RemoteTrack
      // We might want to ensure this is the specific videoTrack we are interested in, though often it will be.
      if (videoTrack.trackSid === track.sid) {
        handleSubscribedChanged(track);
      }
    };
    
    videoTrack.on(TrackEvent.Subscribed, onTrackSubscribed);
    
    return () => {
      if (videoTrack) {
        videoTrack.off(TrackEvent.Subscribed, onTrackSubscribed);
      }
      
      // Cleanup
      if (videoRef.current) {
        try {
          if (videoTrack.track) {
            videoTrack.track.detach(videoRef.current);
          }
        } catch (e) {
          console.error('TestAvatarVideoDisplay: Error detaching track:', e);
        }
      }
    };
  }, [participant]);
  
  const handlePlayClick = () => {
    if (videoRef.current) {
      videoRef.current.play()
        .then(() => {
          console.log('TestAvatarVideoDisplay: Manual playback started');
          setShowPlayButton(false);
        })
        .catch(e => {
          console.error('TestAvatarVideoDisplay: Manual playback failed:', e);
          setError(`Manual playback failed: ${e.message}`);
        });
    }
  };

  return (
    <div className="flex flex-col w-full max-w-3xl mx-auto">
      <div className="relative w-full h-0 pb-[56.25%] bg-black mb-4 rounded-lg overflow-hidden">
        <video 
          ref={videoRef}
          autoPlay 
          playsInline
          muted
          className="absolute top-0 left-0 w-full h-full object-cover" 
        />
        
        {showPlayButton && (
          <button 
            onClick={handlePlayClick}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-6 py-3 bg-black bg-opacity-70 text-white border-none rounded-lg cursor-pointer text-xl z-10"
          >
            ▶️ Play Video
          </button>
        )}
      </div>
      
      <div className="bg-gray-100 p-4 rounded-lg mt-4">
        <h3 className="text-lg font-medium">Debug Information</h3>
        {error && <p className="text-red-500 font-bold">{error}</p>}
        <p>Participant: {participant ? participant.identity : 'None'}</p>
        <p>Track Attached: {hasAttached ? 'Yes' : 'No'}</p>
        
        {currentTrack && (
          <div>
            <h4 className="text-md font-medium mt-2">Track Details</h4>
            <ul className="list-disc pl-5 mt-1">
              {Object.entries(debugInfo).map(([key, value]) => (
                <li key={key}>
                  <strong>{key}:</strong> {String(value)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
