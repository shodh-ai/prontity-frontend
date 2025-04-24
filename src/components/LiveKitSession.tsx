'use client';

import {
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
  RoomContext,
  useLocalParticipant
} from '@livekit/components-react';
import { Room, Track } from 'livekit-client';
import { useEffect, useState } from 'react';
import AgentController from '@/components/AgentController';
import CustomControls from '@/components/CustomControls';
import VideoTiles from '@/components/VideoTiles';
import '@livekit/components-styles';
import '@/app/room/figma-styles.css';
import '@/styles/custom-controls.css';
import '@/styles/figma-exact.css';

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
        const resp = await fetch(`/api/token?room=${roomName}&username=${userName}`);
        
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
      <div data-lk-theme="default" className="figma-room-container">
        {/* Background elements are handled by ::before and ::after in CSS */}
        
        {/* Backdrop blur */}
        <div className="backdrop-blur"></div>
        
        {/* Main content area */}
        <div className="main-content">
          {/* Close icon in top right */}
          <div className="close-icon" onClick={handleLeave}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="#717171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          
          {/* Session title */}
          <div className="session-title">{sessionTitle}</div>
          
          {/* Progress indicator */}
          <div className="progress-container">
            <div className="progress-bg"></div>
            <div className="progress-fill"></div>
          </div>
          
          {/* Question container */}
          <div className="question-container">
            <div className="question-label">Question</div>
            <div className="question-text">{questionText}</div>
          </div>
          
          {/* Video tiles */}
          <VideoTiles />
          
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

// VideoConference component has been replaced by the VideoTiles component

