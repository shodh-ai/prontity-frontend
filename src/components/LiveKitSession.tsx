'use client';

import {
  RoomAudioRenderer,
  useTracks,
  RoomContext,
  useLocalParticipant,
  useParticipants,
  TrackReference,
  useRoomContext
} from '@livekit/components-react';
import { Room, Track, RoomEvent, ConnectionState, Participant, RemoteParticipant } from 'livekit-client';
import { useEffect, useState, useRef } from 'react';
import AgentController from '@/components/AgentController';
import '@/app/room/figma-styles.css'; // Using Next.js alias for src directory

interface LiveKitSessionProps {
  roomName: string;
  userName: string;
  // Add other props as needed, e.g., onLeave callback
}

export default function LiveKitSession({ roomName, userName }: LiveKitSessionProps) {
  const [token, setToken] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [roomInstance] = useState(() => new Room({
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: {
      resolution: { width: 1280, height: 720 },
      facingMode: 'user',
    },
    audioCaptureDefaults: {
      sampleRate: 48000,
      sampleSize: 16,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  }));

  // Mark component as mounted on first render
  useEffect(() => {
    setIsMounted(true);
    // Attempt to enable audio automatically on mount
    enableAudio();
    return () => setIsMounted(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track room connection state
  useEffect(() => {
    const handleConnectionStateChanged = (state: ConnectionState) => {
      setConnectionState(state);
      console.log('Room connection state changed:', state);
    };

    roomInstance.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);

    return () => {
      roomInstance.off(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
    };
  }, [roomInstance]);

  // Fetch token and connect to room
  useEffect(() => {
    if (!isMounted || !audioEnabled) return;

    let mounted = true;
    (async () => {
      try {
        console.log(`Fetching token for room: ${roomName}, user: ${userName}`);
        const resp = await fetch(`/api/token?room=${roomName}&username=${userName}`);
        if (!resp.ok) {
          throw new Error(`Failed to fetch token: ${resp.status} ${resp.statusText}`);
        }
        const data = await resp.json();
        if (!mounted) return;

        if (data.token) {
          setToken(data.token);
          console.log('Token received, connecting to LiveKit room...');
          // Make sure wsUrl exists before using it
          if (!data.wsUrl) {
            console.error('No WebSocket URL returned from API');
            return;
          }
          await roomInstance.connect(data.wsUrl, data.token);
          console.log('Successfully connected to LiveKit room');
        } else {
          console.error('Failed to get token from API');
        }
      } catch (e) {
        console.error('Error fetching token or connecting:', e);
      }
    })();

    return () => {
      mounted = false;
      if (roomInstance.state !== ConnectionState.Disconnected) {
        console.log('Disconnecting from LiveKit room...');
        roomInstance.disconnect();
      }
    };
  }, [roomInstance, audioEnabled, isMounted, roomName, userName]);

  // Handle audio context and microphone initialization
  const enableAudio = async () => {
    if (!audioEnabled) {
      try {
        // Check if browser supports required APIs
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Browser does not support mediaDevices API');
        }
        
        console.log('Requesting microphone permissions...');
        await navigator.mediaDevices.getUserMedia({ audio: true })
          .catch(err => {
            console.error('Microphone access error:', err);
            alert('Microphone access is required. Please enable it in your browser settings.');
            throw err; // Re-throw to be caught by outer catch
          });
        console.log('Microphone permissions granted.');

        // Check if AudioContext is supported
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          throw new Error('Browser does not support AudioContext');
        }
        
        console.log('Initializing AudioContext...');
        const audioCtx = new AudioContextClass();
        const silentBuffer = audioCtx.createBuffer(1, 1, 22050);
        const source = audioCtx.createBufferSource();
        source.buffer = silentBuffer;
        source.connect(audioCtx.destination);
        source.start();

        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        console.log('✅ AudioContext successfully initialized with state:', audioCtx.state);
        (window as any).livekitAudioContext = audioCtx;

        // Use setTimeout to ensure state updates have completed before connecting
        setTimeout(() => {
          setAudioEnabled(true);
          console.log('Audio enabled state set to true.');
        }, 200);

      } catch (error) {
        console.error('Error initializing audio:', error);
        alert(`Audio initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please refresh and try again.`);
      }
    }
  };

  // Render loading/error state or the RoomContext provider
  if (!audioEnabled) {
    return <div className="figma-room-container"><div className="figma-content">Initializing audio and requesting permissions...</div></div>;
  }

  if (connectionState === ConnectionState.Connecting || !token) {
      return <div className="figma-room-container"><div className="figma-content">Connecting to session...</div></div>;
  }
  
  if (connectionState === ConnectionState.Disconnected) {
      return <div className="figma-room-container"><div className="figma-content">Disconnected. Check console for errors or try refreshing.</div></div>;
  }

  // Only render RoomContent once connected
  return (
    <RoomContext.Provider value={roomInstance}>
      <RoomContentInner room={roomName} />
    </RoomContext.Provider>
  );
}

// Inner component that uses LiveKit hooks (needs to be within RoomContext.Provider)
function RoomContentInner({ room }: { room: string }) {
  const roomInstance = useRoomContext();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.Microphone, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [isSpeaking, setIsSpeaking] = useState(false); 
  const [activeSpeakerIdentity, setActiveSpeakerIdentity] = useState<string | null>(null);
  const speakingTimer = useRef<NodeJS.Timeout | null>(null);

  // Separate AI and User tracks
  const aiTracks = tracks.filter(trackRef => trackRef.participant.identity === 'agent-1');
  const userTracks = tracks.filter(trackRef => trackRef.participant.isLocal);

  // Check if any remote participant is speaking
  useEffect(() => {
    const checkActiveSpeakers = () => {
      const remoteParticipants = participants.filter((p): p is RemoteParticipant => !p.isLocal);
      
      // Find the first speaking remote participant
      const currentSpeaker: RemoteParticipant | undefined = remoteParticipants.find(p => p.isSpeaking);

      if (currentSpeaker) {
        // Speaker found
        setActiveSpeakerIdentity(currentSpeaker.identity); // Directly access identity
        if (speakingTimer.current) clearTimeout(speakingTimer.current);
        // Set a timer to remove active speaker status after a delay
        speakingTimer.current = setTimeout(() => {
           setActiveSpeakerIdentity(null);
        }, 1500); // Adjust delay as needed
      } else {
        // No speaker found
        // If no one is speaking currently, ensure the active speaker is cleared
        // but respect the timeout if it was recently set
        if (!speakingTimer.current) { // Only clear if no timer is active
           setActiveSpeakerIdentity(null);
        }
      }
      
      // Update the general speaking state if needed
      setIsSpeaking(!!currentSpeaker); 
    };

    const interval = setInterval(checkActiveSpeakers, 300); // Check every 300ms

    return () => {
        clearInterval(interval);
        if (speakingTimer.current) clearTimeout(speakingTimer.current);
    };
  }, [participants]);

  // Simplified component to display videos in Figma layout
  const VideoTileView = ({ trackRef, isAI = false }: { trackRef?: TrackReference, isAI?: boolean }) => {
    const videoEl = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [isSpeakingIndicator, setIsSpeakingIndicator] = useState(false);

    // Track attachment/detachment with proper cleanup
    useEffect(() => {
      // Skip if no video element or track
      if (!videoEl.current || !trackRef?.publication?.track) return;
      
      const el = videoEl.current;
      try {
        console.log(`Attaching ${isAI ? 'AI' : 'user'} video track`); 
        trackRef.publication.track.attach(el);
      } catch (err) {
        console.error('Error attaching video track:', err);
      }
      
      // Cleanup function
      return () => {
        try {
          if (trackRef?.publication?.track) {
            trackRef.publication.track.detach(el);
          }
        } catch (err) {
          console.error('Error detaching video track:', err);
        }
      };
    }, [trackRef, isAI]);

    useEffect(() => {
       setIsMuted(!trackRef?.participant?.isMicrophoneEnabled);
       setIsCameraOff(!trackRef?.participant?.isCameraEnabled);
       setIsSpeakingIndicator(trackRef?.participant?.isSpeaking ?? false);

      // Directly check active speaker for the AI tile highlight
       if (isAI && trackRef?.participant?.identity) {
          setIsSpeakingIndicator(activeSpeakerIdentity === trackRef.participant.identity);
       }
       
    }, [trackRef?.participant?.isMicrophoneEnabled, 
        trackRef?.participant?.isCameraEnabled, 
        trackRef?.participant?.isSpeaking,
        activeSpeakerIdentity,
        isAI,
        trackRef?.participant?.identity]);

    const placeholderClass = !trackRef || isCameraOff ? 'figma-video-placeholder' : '';
    const speakingClass = isSpeakingIndicator && !isAI ? 'figma-speaking-border' : ''; // Only non-AI speaker border
    const aiSpeakingClass = isSpeakingIndicator && isAI ? 'figma-ai-speaking-highlight' : ''; // Highlight for AI

    return (
      <div className={`figma-video-tile ${placeholderClass} ${speakingClass} ${aiSpeakingClass}`}>
        <video ref={videoEl} width="100%" height="100%" style={{ objectFit: 'cover' }} />
        {(!trackRef || isCameraOff) && (
          <div className="figma-video-off-overlay">
            {/* Placeholder content, e.g., an icon or participant name */} 
            <span>{trackRef?.participant?.identity ?? (isAI ? 'AI Agent' : 'User')}</span>
          </div>
        )}
        {!isAI && isMuted && (
          <div className="figma-mic-muted-indicator">
            {/* Mic Muted Icon */} 
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="white"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="1" y1="1" x2="23" y2="23" strokeWidth="2" stroke="red"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="figma-room-container">
      {/* Removed figma-backdrop and figma-content wrappers as they might be page-specific */}
      {/* Keep layout structure inside if it's generic, or expect parent to provide it */}
      
        <div className="figma-session-title">Speaking Practice Session</div>
        
        <div className="figma-progress">
          <div className="figma-progress-bg"></div>
          <div className="figma-progress-fill"></div>
        </div>
        
        {/* Question area - Consider making this configurable via props/children */} 
        <div className="figma-question-container">
          <div className="figma-question-label">Question</div>
          <div className="figma-question-text">
            {/* Placeholder or passed-in question */} 
            What measures should be taken to ensure education remains effective?
          </div>
        </div>
        
        <div className="figma-video-container">
          {/* AI participant tile */} 
          <VideoTileView trackRef={aiTracks[0]} isAI={true} />
          
          {/* User participant tile */} 
          <VideoTileView trackRef={userTracks[0]} isAI={false} />
        </div>
        
        <div className="figma-controls">
          <button 
            className={`figma-button ${!localParticipant?.isMicrophoneEnabled ? 'figma-button-disabled' : ''}`}
            onClick={() => {
              localParticipant?.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
            }}
            disabled={!localParticipant} // Disable if localParticipant isn't available yet
          >
             <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke={localParticipant?.isMicrophoneEnabled ? '#566FE9' : '#999'}>
              {!localParticipant?.isMicrophoneEnabled && (
                <line x1="1" y1="1" x2="23" y2="23" strokeWidth="2" stroke="red" />
              )}
              <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" fill="none" strokeWidth="1.5"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" strokeWidth="1.5" />
              <line x1="12" y1="19" x2="12" y2="22" strokeWidth="1.5" />
            </svg>
          </button>
          
          <button 
            className="figma-button"
            onClick={() => {
              localParticipant?.setCameraEnabled(!localParticipant.isCameraEnabled);
            }}
            disabled={!localParticipant}
          >
            {/* Camera Icon (simplified) */} 
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke="#566FE9" fill="none" strokeWidth="1.5">
               {!localParticipant?.isCameraEnabled && (
                 <line x1="1" y1="1" x2="23" y2="23" strokeWidth="2" stroke="red" />
               )}
              <path d="M23 7l-7 5 7 5V7z"/> 
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </button>
          
          <button 
            className="figma-button figma-button-leave" // Added leave class for potential styling
            onClick={() => {
              if (confirm('Are you sure you want to leave this session?')) {
                // Consider using an onLeave prop callback instead of hardcoding
                roomInstance.disconnect(); 
                window.location.href = '/'; // Or redirect via Next router
              }
            }}
          >
             {/* Leave Icon (simplified) */} 
             <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke="red" fill="none" strokeWidth="1.5">
               <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
               <polyline points="16 17 21 12 16 7"/>
               <line x1="21" y1="12" x2="9" y2="12"/>
             </svg>
          </button>
        </div>
      
      {/* Hidden but functional LiveKit audio renderer */} 
      <div style={{ display: 'none' }}>
        <RoomAudioRenderer />
      </div>
      
      {/* Hidden but functional agent controller */}
      <div style={{ display: 'none' }}>
        <AgentController roomName={room} />
      </div>
    </div>
  );
}
