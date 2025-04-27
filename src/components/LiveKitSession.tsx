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
import { useEffect, useState, useCallback } from 'react';
import AgentController from '@/components/AgentController';
import CustomControls from '@/components/CustomControls';
import VideoTiles from '@/components/VideoTiles';
import TimerController from '@/components/TimerController';
import { getTokenEndpointUrl, tokenServiceConfig } from '@/config/services';
import '@livekit/components-styles';
import '@/app/speakingpage/figma-styles.css';
import '@/styles/figma-exact.css';
import '@/styles/enhanced-room.css';

export type PageType = 'speaking' | 'speakingpage' | 'writing' | 'vocab' | 'reflection' | 'rox' | 'login' | 'default';

interface LiveKitSessionProps {
  roomName: string;
  userName: string;
  questionText?: string;
  sessionTitle?: string;
  onLeave?: () => void;
  pageType?: PageType;
  showTimer?: boolean;
  timerDuration?: number;
  customControls?: React.ReactNode;
  hideVideo?: boolean;
  hideAudio?: boolean;
  aiAssistantEnabled?: boolean;
}

export default function LiveKitSession({
  roomName,
  userName,
  questionText,
  sessionTitle = "LiveKit Session",
  onLeave,
  pageType = 'default',
  showTimer = false,
  timerDuration = 45,
  customControls,
  hideVideo = false,
  hideAudio = false,
  aiAssistantEnabled = true
}: LiveKitSessionProps) {
  const [token, setToken] = useState('');
  const [audioInitialized, setAudioInitialized] = useState<boolean>(false);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [micHeartbeat, setMicHeartbeat] = useState<NodeJS.Timeout | null>(null);
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

  // Helper function to determine page-specific styles and components
  const getPageSpecificClasses = () => {
    switch (pageType) {
      case 'speaking':
        return 'speaking-page-container';
      case 'writing':
        return 'writing-page-container';
      case 'vocab':
        return 'vocab-page-container';
      case 'reflection':
        return 'reflection-page-container';
      case 'rox':
        return 'rox-page-container';
      default:
        return 'default-page-container';
    }
  };
  
  // Helper function to toggle audio on/off
  const toggleAudio = useCallback(() => {
    setAudioEnabled(prev => {
      const newState = !prev;
      // Also enable/disable microphone in LiveKit
      try {
        const localParticipant = roomInstance.localParticipant;
        if (localParticipant) {
          const micTrack = localParticipant.getTrackPublication(Track.Source.Microphone);
          if (micTrack) {
            if (newState) {
              micTrack.unmute();
            } else {
              micTrack.mute();
            }
          }
        }
      } catch (err) {
        console.error('Error toggling microphone:', err);
      }
      return newState;
    });
  }, [roomInstance]);

  // Function to enable microphone with auto-reconnect
  const enableMicrophone = useCallback(async () => {
    try {
      if (roomInstance) {
        await roomInstance.localParticipant.setMicrophoneEnabled(true);
        setAudioEnabled(true);
        console.log('Microphone enabled');
        
        // Set up a heartbeat to keep the microphone active
        const heartbeatInterval = setInterval(async () => {
          if (roomInstance && !roomInstance.localParticipant.isMicrophoneEnabled) {
            console.log('Microphone heartbeat - reconnecting microphone');
            try {
              await roomInstance.localParticipant.setMicrophoneEnabled(true);
            } catch (err) {
              console.error('Failed to reconnect microphone in heartbeat:', err);
            }
          }
        }, 5000); // Check every 5 seconds
        
        // Store the interval ID for cleanup
        setMicHeartbeat(heartbeatInterval);
      }
    } catch (error) {
      console.error('Failed to enable microphone:', error);
    }
  }, [roomInstance]);

  // Function to initialize audio context after user interaction
  const initializeAudio = useCallback(() => {
    // Skip audio initialization if this page type doesn't need audio
    if (hideAudio) {
      setAudioInitialized(true);
      return;
    }
    
    console.log('Initializing audio...');
    
    // Request microphone permission explicitly
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        console.log('Microphone permission granted, stream tracks:', stream.getTracks().length);
        
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
        
        // The stream can be stopped since LiveKit will request it again
        stream.getTracks().forEach(track => track.stop());
        
        setAudioInitialized(true);
        console.log('Audio initialization complete');
        
        // Clean up this temporary audio context if needed
        if (audioContext.state !== 'closed') {
          setTimeout(() => {
            audioContext.close().catch(err => {
              console.error('Failed to close temporary AudioContext:', err);
            });
          }, 1000);
        }
        
        // Enable microphone after audio initialization
        enableMicrophone();
      })
      .catch(err => {
        console.error('Error getting microphone permission:', err);
        alert('Microphone permission is required for this application. Please enable it in your browser settings.');
      });
  }, [hideAudio, enableMicrophone]);

  // Connect to LiveKit room when component mounts and audio is initialized
  useEffect(() => {
    if (!audioInitialized && !hideAudio) {
      // If audio isn't initialized and we need it, don't proceed yet
      console.log('Waiting for audio initialization before connecting...');
      return;
    }

    console.log('Audio initialized or not needed, proceeding with LiveKit connection');

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
      // Clear the microphone heartbeat if it exists
      if (micHeartbeat) {
        clearInterval(micHeartbeat);
      }
      
      roomInstance.disconnect();
      console.log('Disconnected from LiveKit room');
    };
  }, [roomInstance, roomName, userName, audioInitialized, hideAudio, micHeartbeat]);

  // Show audio initialization prompt if audio isn't initialized yet
  if (!audioInitialized && !hideAudio) {
    return (
      <div className={`figma-room-container ${getPageSpecificClasses()}`}>
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
  } else if (!audioInitialized && hideAudio) {
    // If audio is disabled for this page type, simply skip initialization
    setAudioInitialized(true);
  }
  
  // Show loading state while waiting for token
  if (token === '') {
    return <div className={`figma-room-container ${getPageSpecificClasses()}`}>
      <div className="figma-content">Connecting to session...</div>
    </div>;
  }



  // Handle leaving the session
  const handleLeave = () => {
    if (onLeave) {
      onLeave();
    } else {
      window.location.href = '/';
    }
  };

  // Prepare additional page-specific props for each page type
  const getPageSpecificProps = () => {
    // You can extend this function to add more page-specific props as needed
    switch (pageType) {
      case 'speaking':
      case 'speakingpage':
        return {
          showAgentStatus: true,
          showTimer: true
        };
      case 'writing':
        return {
          showAgentStatus: true,
          showTimer: false
        };
      case 'vocab':
        return {
          showAgentStatus: false,
          showTimer: false
        };
      default:
        return {
          showAgentStatus: true,
          showTimer: false
        };
    }
  };
  
  // Get the specific props for this page type
  const pageProps = getPageSpecificProps();

  return (
    <RoomContext.Provider value={roomInstance}>
      <div className={`session-container ${getPageSpecificClasses()}`}>
        {/* Add RoomAudioRenderer for audio output */}
        <RoomAudioRenderer />
        <div className="header">
          <h2>{sessionTitle}</h2>
          {pageType !== 'login' && (
            <div className="question-container">
              {questionText && (
                <div className="question-card">
                  <h3>Question:</h3>
                  <p>{questionText}</p>
                </div>
              )}
              
              {/* Timer will appear here when activated by the agent */}
              {token && (pageType === 'speaking' || pageType === 'speakingpage') && (
                <TimerController visible={true} />
              )}
            </div>
          )}
        </div>

        <div className="conference-container">
          {/* Only render video conference if connected to room and video should be shown */}
          {token && !hideVideo && (
            <VideoTiles />
          )}

          {/* Controls rendered separately from video */}
          <div className="custom-controls">
            {/* Microphone toggle button */}
            {!hideAudio && (
              <button 
                className="custom-button" 
                onClick={toggleAudio}
                style={{
                  background: audioEnabled ? '#FFFFFF' : '#D7D7D7',
                  border: audioEnabled ? '1px solid #566FE9' : '1px solid #888888'
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" 
                    stroke={audioEnabled ? '#566FE9' : '#888888'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" 
                    stroke={audioEnabled ? '#566FE9' : '#888888'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  {!audioEnabled && (
                    <path d="M3 3l18 18" stroke="#FF0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                </svg>
              </button>
            )}

            {/* Custom controls can be injected here */}
            {customControls}

            {/* Leave session button */}
            <button 
              className="custom-button" 
              onClick={handleLeave}
              style={{
                background: '#FFFFFF',
                border: '1px solid #566FE9'
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 17l5-5-5-5" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 12H9" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* AI Agent Controller - silently initialized in the background */}
        {aiAssistantEnabled && audioInitialized && (
          <div className="hidden">
            <AgentController roomName={roomName} pageType={pageType} />
          </div>
        )}
      </div>
    </RoomContext.Provider>
  );
}
