'use client';

import {
  ControlBar,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
  RoomContext,
} from '@livekit/components-react';
import { Room, Track } from 'livekit-client';
import '@livekit/components-styles';
import { useEffect, useState } from 'react';
import AgentController from '@/components/AgentController';

export default function Page() {
  // TODO: get user input for room and name
  const room = 'quickstart-room';
  const name = 'quickstart-user';
  const [token, setToken] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(false);
  // Track if the component is mounted to avoid state updates after unmount
  const [isMounted, setIsMounted] = useState(false);
  const [roomInstance] = useState(() => new Room({
    // Optimize video quality for each participant's screen
    adaptiveStream: true,
    // Enable automatic audio/video quality optimization
    dynacast: true,
  }));

  // Mark component as mounted on first render
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Fetch token and connect to room
  useEffect(() => {
    if (!isMounted) return; // Skip first render before mount effect completes
    
    let mounted = true;
    (async () => {
      try {
        const resp = await fetch(`/api/token?room=${room}&username=${name}`);
        const data = await resp.json();
        if (!mounted) return;
        if (data.token) {
          setToken(data.token);
          // Only connect to the room if audio has been enabled
          if (audioEnabled) {
            console.log('Connecting to LiveKit room with token...');
            // Get LiveKit URL from the API response instead of client environment variables
            await roomInstance.connect(data.wsUrl, data.token);
          }
        }
      } catch (e) {
        console.error(e);
      }
    })();
  
    return () => {
      mounted = false;
      roomInstance.disconnect();
    };
  }, [roomInstance, audioEnabled, isMounted, room, name]); // Include all dependencies

  // Handle audio context initialization (requires user interaction)
  const enableAudio = () => {
    if (!audioEnabled) {
      try {
        // Create and resume AudioContext to fix the browser warning
        // This needs to happen synchronously within the click handler
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Create a short silent sound to "warm up" the audio context
        const silentBuffer = audioCtx.createBuffer(1, 1, 22050);
        const source = audioCtx.createBufferSource();
        source.buffer = silentBuffer;
        source.connect(audioCtx.destination);
        source.start();
        
        // Force resume the context
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        
        console.log('✅ AudioContext successfully initialized with state:', audioCtx.state);
        
        // Add the audio context to window for debugging and potential reuse
        (window as any).livekitAudioContext = audioCtx;
        
        // Set timeout to ensure UI update happens after audio initialization
        setTimeout(() => {
          setAudioEnabled(true);
        }, 100);
      } catch (error) {
        console.error('Error initializing AudioContext:', error);
        // Still try to enable the UI even if there's an error
        setAudioEnabled(true);
      }
    }
  };

  if (token === '') {
    return <div>Getting token...</div>;
  }
  
  if (!audioEnabled) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <h1 className="text-2xl font-bold mb-4">Ready to Join Room</h1>
          <p className="mb-6">Click the button below to enable audio and join the video conference.</p>
          <button 
            onClick={enableAudio}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Join Video Conference
          </button>
        </div>
      </div>
    );
  }

  return (
    <RoomContext.Provider value={roomInstance}>
      <div data-lk-theme="default" style={{ height: '100dvh' }}>
        {/* Agent connection controller */}
        <div className="absolute top-4 right-4 z-10 w-80">
          <AgentController roomName={room} />
        </div>
        
        {/* Audio context message - helps users understand what's happening */}
        <div className="absolute top-4 left-4 z-10 p-2 bg-blue-100 text-blue-800 rounded-md shadow-sm text-sm max-w-xs">
          <p>Audio enabled: {audioEnabled ? '✅' : '❌'}</p>
          <p className="text-xs mt-1">If you experience audio issues, try refreshing the page and clicking the Join button again.</p>
        </div>
        
        {/* Your custom component with basic video conferencing functionality. */}
        <MyVideoConference />
        {/* The RoomAudioRenderer takes care of room-wide audio for you. */}
        <RoomAudioRenderer />
        {/* Controls for the user to start/stop audio, video, and screen share tracks */}
        <ControlBar />
      </div>
    </RoomContext.Provider>
  );
}

function MyVideoConference() {
  // `useTracks` returns all camera and screen share tracks. If a user
  // joins without a published camera track, a placeholder track is returned.
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  return (
    <GridLayout tracks={tracks} style={{ height: 'calc(100vh - var(--lk-control-bar-height))' }}>
      {/* The GridLayout accepts zero or one child. The child is used
      as a template to render all passed in tracks. */}
      <ParticipantTile />
    </GridLayout>
  );
}