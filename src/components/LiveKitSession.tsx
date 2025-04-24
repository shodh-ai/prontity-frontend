'use client';

import {
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
  RoomContext,
} from '@livekit/components-react';
import { Room, Track } from 'livekit-client';
import { useEffect, useState, useCallback } from 'react';
import AgentController from '@/components/AgentController';
import CustomControls from '@/components/CustomControls';
import { getTokenEndpointUrl, tokenServiceConfig } from '@/config/services';
import '@livekit/components-styles';
import '@/app/room/figma-styles.css';
import '@/styles/custom-controls.css';
import '@/styles/enhanced-room.css';

interface LiveKitSessionProps {
  roomName: string;
  userName: string;
  questionText?: string;
  sessionTitle?: string;
  onLeave?: () => void;
}

export default function LiveKitSession({
  roomName,
  userName,
  questionText = "With the rise of automation and artificial intelligence, there is a growing concern about the future of jobs and the relevance of traditional education. What measures do you think should be taken to ensure that education remains effective in preparing individuals for the workforce?",
  sessionTitle = "Speaking Practice Session",
  onLeave
}: LiveKitSessionProps) {
  const [token, setToken] = useState('');
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [roomInstance] = useState(() => new Room({
    // Optimize video quality for the user's screen
    adaptiveStream: true,
    // Enable automatic quality optimization
    dynacast: true,
    // Basic audio configuration
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    }
  }));

  // Function to initialize audio context after user interaction
  const initializeAudio = () => {
    // Create a temporary audio context to ensure browser allows audio
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    // Resume the audio context
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        console.log('AudioContext resumed successfully');
      }).catch(err => {
        console.error('Failed to resume AudioContext:', err);
      });
    }
    
    setAudioInitialized(true);
    
    // Clean up this temporary audio context if needed
    if (audioContext.state !== 'closed') {
      setTimeout(() => {
        audioContext.close().catch(err => {
          console.error('Failed to close temporary AudioContext:', err);
        });
      }, 1000);
    }
  };

  // Connect to LiveKit room when component mounts and audio is initialized
  useEffect(() => {
    // Don't connect until audio is initialized
    if (!audioInitialized) return;
    
    let mounted = true;
    
    const connectToRoom = async () => {
      try {
        console.log(`Connecting to room: ${roomName} as ${userName}`);
        
        // Use the dedicated token service URL from config
        const tokenUrl = getTokenEndpointUrl(roomName, userName);
        
        // Setup request options including API key header if configured
        const fetchOptions: RequestInit = {
          headers: {}
        };
        if (tokenServiceConfig.includeApiKeyInClient && tokenServiceConfig.apiKey) {
          (fetchOptions.headers as Record<string, string>)['x-api-key'] = tokenServiceConfig.apiKey;
        }
        
        // Fetch token from dedicated service
        const resp = await fetch(tokenUrl, fetchOptions);
        
        if (!resp.ok) {
          throw new Error(`Failed to get token: ${resp.status} ${resp.statusText}`);
        }
        
        const data = await resp.json();
        if (!mounted) return;
        
        if (data.token) {
          setToken(data.token);
          await roomInstance.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL || data.wsUrl, data.token);
          console.log('Successfully connected to LiveKit room');
          
          // Start AI agent
          fetch(`/api/agent?room=${roomName}`).catch(e => 
            console.error('Error starting AI agent:', e)
          );
        } else {
          console.error('Failed to get token from API');
        }
      } catch (e) {
        console.error('Error connecting to room:', e);
      }
    };
    
    connectToRoom();
    
    // Cleanup when component unmounts
    return () => {
      mounted = false;
      roomInstance.disconnect();
      console.log('Disconnected from LiveKit room');
    };
  }, [roomInstance, roomName, userName, audioInitialized]);

  // Show audio initialization prompt if audio isn't initialized yet
  if (!audioInitialized) {
    return (
      <div className="figma-room-container">
        <div className="figma-content">
          <h3>Enable Audio</h3>
          <p>To participate in this session, we need permission to use your microphone.</p>
          <button 
            className="figma-button"
            onClick={initializeAudio}
          >
            Click to Enable Audio
          </button>
        </div>
      </div>
    );
  }
  
  // Show loading state while waiting for token
  if (token === '') {
    return <div className="figma-room-container">
      <div className="figma-content">Connecting to session...</div>
    </div>;
  }

  const handleLeave = () => {
    if (onLeave) {
      onLeave();
    } else {
      window.location.href = '/';
    }
  };

  // Return the LiveKit room UI
  return (
    <RoomContext.Provider value={roomInstance}>
      <div data-lk-theme="default" className="enhanced-room-container">
        {/* Background elements */}
        <div className="bg-circle-1"></div>
        <div className="bg-circle-2"></div>
        <div className="backdrop-blur"></div>
        
        {/* Main content */}
        <div className="main-content">
          {/* Progress indicator */}
          <div className="progress-container">
            <div className="progress-fill" style={{ width: '28%' }}></div>
          </div>
          
          {/* Session title */}
          <div className="session-title">
            {sessionTitle}
          </div>
        
          {/* Question area removed */}
        
          {/* Video conference area */}
          <div className="video-container">
            <VideoConference />
          </div>
          
          {/* Audio renderer */}
          <RoomAudioRenderer volume={0.8} />
          
          {/* Hidden agent controller */}
          <div style={{ display: 'none' }}>
            <AgentController roomName={roomName} />
          </div>
          
          {/* Custom control buttons */}
          <CustomControls onLeave={handleLeave} />
        </div>
      </div>
    </RoomContext.Provider>
  );
}

function VideoConference() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );
  
  // Always show both tiles with proper styling based on enhanced design
  // Even without tracks, we'll show placeholders
  
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
  
  // Check if participants are actively speaking
  const isSpeaking = false; // This would be connected to audio levels in a full implementation
  
  return (
    <>
      {/* User Participant Tile */}
      <div className={`video-tile ${isSpeaking ? 'speaking' : ''}`}>
        {userTrack && userTrack.publication && userTrack.publication.kind === 'video' ? (
          <video 
            ref={el => {
              if (el && userTrack.publication) {
                userTrack.publication.track?.attach(el);
              }
            }}
            autoPlay 
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div 
            style={{ 
              backgroundImage: 'url(/user-placeholder.jpg)', 
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              width: '100%', 
              height: '100%' 
            }} 
          />
        )}
        <div className="video-tile-label">User</div>
      </div>
      
      {/* AI Participant Tile */}
      <div className="video-tile">
        {aiTrack && aiTrack.publication && aiTrack.publication.kind === 'video' ? (
          <video 
            ref={el => {
              if (el && aiTrack.publication) {
                aiTrack.publication.track?.attach(el);
              }
            }}
            autoPlay 
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div 
            style={{ 
              backgroundImage: 'url(/ai-teacher-placeholder.jpg)', 
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              width: '100%', 
              height: '100%' 
            }} 
          />
        )}
        <div className="video-tile-label">AI Speaking Teacher</div>
      </div>
    </>
  );
}

