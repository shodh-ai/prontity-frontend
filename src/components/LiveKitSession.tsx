'use client';

import {
  RoomContext,
  useLocalParticipant,
  RoomAudioRenderer
} from '@livekit/components-react';
import { Room, Track } from 'livekit-client';
import { useEffect, useState, useCallback } from 'react';
import AgentController from '@/components/AgentController';
import CustomControls from '@/components/CustomControls';
import LiveKitSessionUI from '@/components/LiveKitSessionUI';
import { getTokenEndpointUrl, tokenServiceConfig } from '@/config/services';
import '@livekit/components-styles';
import '@/app/speakingpage/figma-styles.css';
import '@/styles/figma-exact.css';
import '@/styles/enhanced-room.css';
import '@/styles/video-controls.css';
import '@/styles/livekit-session-ui.css';

import { PageType } from '@/components/LiveKitSessionUI';

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
  showAvatar?: boolean;
  // New prop for passing the room instance to parent (if needed)
  onRoomCreated?: (room: Room) => void;
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
  aiAssistantEnabled = true,
  showAvatar = false,
  onRoomCreated
}: LiveKitSessionProps) {
  const [token, setToken] = useState('');
  const [audioInitialized, setAudioInitialized] = useState<boolean>(false);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [videoEnabled, setVideoEnabled] = useState<boolean>(!hideVideo);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [micHeartbeat, setMicHeartbeat] = useState<NodeJS.Timeout | null>(null);
  const [roomInstance] = useState(() => new Room({
    // Optimize video quality for the user's screen
    adaptiveStream: true,
    // Enable automatic quality optimization
    dynacast: true,
    // Disable simulcast for better compatibility with avatars
    // Setting higher default video quality
    videoCaptureDefaults: {
      resolution: { width: 640, height: 480, frameRate: 30 }
    },
    // Basic audio configuration
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    // Only use officially supported options in the Room constructor
    // These are important for avatar compatibility
    stopLocalTrackOnUnpublish: false
  }));

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
  
  // Helper function to toggle camera on/off
  const toggleCamera = useCallback(async () => {
    try {
      // Get local participant
      const localParticipant = roomInstance.localParticipant;
      if (!localParticipant) {
        console.error('No local participant found');
        return;
      }
      
      // Check if camera is currently enabled
      const currentState = videoEnabled;
      const newState = !currentState;
      
      if (newState) {
        // Enable camera
        console.log('Enabling camera...');
        await localParticipant.setCameraEnabled(true);
        console.log('Camera enabled successfully');
      } else {
        // Disable camera
        console.log('Disabling camera...');
        await localParticipant.setCameraEnabled(false);
        console.log('Camera disabled successfully');
      }
      
      // Update state
      setVideoEnabled(newState);
    } catch (err) {
      console.error('Error toggling camera:', err);
    }
  }, [roomInstance, videoEnabled]);

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
            console.log('Audio context resumed');
          });
        }
        
        // Stop the local tracks as LiveKit will manage them
        stream.getTracks().forEach(track => track.stop());
        
        // Set audio as initialized
        setAudioInitialized(true);
        
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
    let mounted = true;
    let audioContext: AudioContext | null = null;

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
          
          // Configure audio handling for better avatar compatibility
          if (showAvatar) {
            // Set up enhanced track subscription handling
            roomInstance.on('trackSubscribed', (track, publication, participant) => {
              console.log(`🎧 Track subscribed: ${track.kind} from ${participant.identity}`);
              // Make sure all audio tracks are enabled
              if (track.kind === 'audio') {
                // Log details about the audio track
                console.log('Audio track details:', {
                  trackName: publication.trackName,
                  isMuted: publication.isMuted,
                  isEnabled: publication.isEnabled,
                  participantId: participant.identity
                });
                
                // Try to ensure track is playing
                try {
                  const audioElement = track.attach();
                  audioElement.volume = 1.0;
                  audioElement.muted = false;
                  document.body.appendChild(audioElement); // Attach to DOM to enable audio
                  console.log('Audio track attached to DOM');
                } catch (err) {
                  console.error('Failed to attach audio track:', err);
                }
              }
            });
          }
          
          // Notify parent component of room creation immediately after connecting
          if (onRoomCreated) {
            console.log('Calling onRoomCreated with room instance');
            onRoomCreated(roomInstance);
          }
          
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
    
    if (token) {
      try {
        // Set up event listeners for monitoring participants and tracks
        roomInstance.on('participantConnected', (participant) => {
          console.log(`Participant connected: ${participant.identity}`);
          
          // Log all tracks for this participant
          const tracks = Array.from(participant.trackPublications.values());
          console.log('Available tracks:', tracks.map(t => ({
            kind: t.kind,
            source: t.source,
            trackSid: t.trackSid
          })));
        });
        
        roomInstance.on('trackSubscribed', (track, publication, participant) => {
          console.log(`Track subscribed: ${track.kind} from ${participant.identity}`);
          console.log('Track details:', { 
            trackSid: publication.trackSid,
            source: publication.source,
            kind: track.kind
          });
        });
        
        // Connect to the room
        connectToRoom();
        console.log("Connecting to room...");
      } catch (err) {
        console.error("Error connecting to room:", err);
      }
    } else {
      connectToRoom();
    }
    
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
  } else if (!audioInitialized && hideAudio) {
    // If audio is disabled for this page type, simply skip initialization
    setAudioInitialized(true);
  }
  
  // Show loading state while waiting for token
  if (token === '') {
    return <div className="figma-room-container">
      <div className="figma-content">Connecting to session...</div>
    </div>;
  }

  // Handle leaving the session
  const handleLeave = () => {
    // Call the onLeave callback if provided, but don't redirect
    if (onLeave) {
      onLeave();
    } else {
      console.log('Session ended - no redirect');
      // Clean up room connection
      roomInstance.disconnect();
    }
  };


  return (
    <RoomContext.Provider value={roomInstance}>
      <LiveKitSessionUI
        token={token}
        pageType={pageType}
        sessionTitle={sessionTitle}
        questionText={questionText}
        userName={userName}
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        hideAudio={hideAudio}
        hideVideo={hideVideo}
        showTimer={showTimer}
        toggleAudio={toggleAudio}
        toggleCamera={toggleCamera}
        handleLeave={handleLeave}
        customControls={customControls}
      >
        {/* AI Agent Controller - silently initialized in the background */}
        {aiAssistantEnabled && audioInitialized && (
          <div className="hidden">
            <AgentController 
              roomName={roomName} 
              pageType={pageType} 
              showAvatar={showAvatar}
            />
          </div>
        )}
        
        {/* Audio renderer for LiveKit audio playback */}
        {token && <RoomAudioRenderer />}
      </LiveKitSessionUI>
    </RoomContext.Provider>
  );
}
