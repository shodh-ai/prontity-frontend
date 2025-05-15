'use client';

import { useState, useEffect, useRef } from 'react';
// Router is completely removed to prevent redirects
import ProtectedRoute from '@/components/ProtectedRoute';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import contentApi from '@/api/contentService';
import userProgressApi from '@/api/userProgressService';
import LiveKitSession from '@/components/LiveKitSession';
import { Room, RoomEvent } from 'livekit-client';
import Link from 'next/link';
import SimpleTavusDisplay from '@/components/roxavatar';
import { RoomAudioRenderer } from '@livekit/components-react';
import UserStatus from '@/components/UserStatus';
import BrowserOnly from '@/components/BrowserOnly';

// Using SimpleTavusDisplay component from roxavatar.tsx

function RoxPageContent() {
  // No router used in this component to prevent redirects
  const [userName, setUserName] = useState('');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userProgress, setUserProgress] = useState<any[]>([]);
  const [nextTask, setNextTask] = useState<any>(null);
  const [vocabWords, setVocabWords] = useState<any[]>([]);
  const [speakingTopics, setSpeakingTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false); // Set to false by default to prevent loading screen
  const [error, setError] = useState('');
  
  // Using a simple, fixed room name that matches exactly what you'll use in the agent command
  // This follows the same pattern as speakingpage
  const roomName = 'Roxpage';
  
  // LiveKit and microphone states
  const [liveKitActive, setLiveKitActive] = useState(true); // Always keep LiveKit active
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [heartbeatActive, setHeartbeatActive] = useState(false);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  
  // Add the missing roomRef definition
  const roomRef = useRef<Room | null>(null);
  
  // State to manage UserStatus display - Debug with console logging
  const [showUserStatus, setShowUserStatus] = useState(false);
  const [userToken, setUserToken] = useState<string>("");
  
  // Debug function for user status toggle
  const toggleUserStatus = () => {
    console.log('Toggle user status called, before:', showUserStatus);
    setShowUserStatus(prevState => {
      console.log('Setting showUserStatus to:', !prevState);
      return !prevState;
    });
  };
  
  // Get username and token from session or localStorage when component mounts
  useEffect(() => {
    // Cleanup function to properly handle component unmount
    return () => {
      console.log('Roxpage component unmounting - cleaning up connections');
      // Properly close the room connection if it exists
      if (roomRef.current) {
        try {
          // Disable the microphone first
          if (roomRef.current.localParticipant) {
            roomRef.current.localParticipant.setMicrophoneEnabled(false);
          }
          // Properly disconnect the room
          roomRef.current.disconnect(true);
          roomRef.current = null;
        } catch (err) {
          console.error('Error during room cleanup:', err);
        }
      }
      handleLeave();
      stopHeartbeat();
    };
  }, []);

  useEffect(() => {
    // Get username directly from localStorage
    const storedUserName = localStorage.getItem('userName');
    if (storedUserName) {
      setUserName(storedUserName);
    }
    
    // Get token for UserStatus component with debug logging
    const token = localStorage.getItem('token');
    console.log('Token from localStorage:', token ? 'Found token' : 'No token found');
    if (token) {
      setUserToken(token);
      console.log('UserToken state set');
    } else {
      // For testing/debugging purposes, set a fallback token
      console.log('No token found in localStorage, using fallback for testing');
      setUserToken('testing-fallback-token');
    }
    
    // Fetch user data from services
    const fetchUserData = async () => {
      try {
        // Set loading to false immediately so we can render content right away
        setLoading(false);
        
        // Get sample vocabulary words
        const vocabSamples = ['ubiquitous', 'ameliorate', 'ephemeral', 'serendipity'];
        const vocabPromises = vocabSamples.map(id => contentApi.getVocabWord(id));
        
        // Get sample speaking topics
        const topicSamples = ['topic-daily-routine', 'topic-climate-change', 'topic-technology'];
        const topicPromises = topicSamples.map(id => contentApi.getSpeakingTopic(id));
        
        // Fetch user profile and progress if token exists
        const token = localStorage.getItem('token');
        let profileData = null;
        let progressData = [];
        let nextTaskData = null;
        
        if (token) {
          try {
            profileData = await userProgressApi.getUserProfile();
            progressData = await userProgressApi.getUserProgress();
            nextTaskData = await userProgressApi.getNextTask();
          } catch (err) {
            console.error('Error fetching user data:', err);
            // Token might be invalid, but we'll continue with content data
          }
        }
        
        // Resolve all promises
        const [vocabResults, topicResults] = await Promise.all([
          Promise.allSettled(vocabPromises),
          Promise.allSettled(topicPromises)
        ]);
        
        // Extract successful results
        const validVocabWords = vocabResults
          .filter(result => result.status === 'fulfilled')
          .map(result => (result as PromiseFulfilledResult<any>).value);
          
        const validTopics = topicResults
          .filter(result => result.status === 'fulfilled')
          .map(result => (result as PromiseFulfilledResult<any>).value);
        
        setVocabWords(validVocabWords);
        setSpeakingTopics(validTopics);
        setUserProfile(profileData);
        setUserProgress(progressData);
        setNextTask(nextTaskData);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load content. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, []); // No dependencies needed since we're using localStorage directly

  // Navigation to other practice sections with context - using window.location to avoid router
  const navigateToSpeaking = () => {
    // Using localStorage to pass data between pages
    if (typeof window !== 'undefined') {
      try {
        // Store question data to retrieve in the speaking page
        const questionData = {
          topicName: 'Daily Routine', // Example topic
          question: 'Tell me about your daily routine', // Example question
          level: 'Beginner', // Default level
          timestamp: Date.now() // Add timestamp to make object unique
        };
        
        // Save to localStorage to pass the data
        localStorage.setItem('speakingQuestion', JSON.stringify(questionData));
        // We'll use Link component for navigation instead of direct location changes
      } catch (err) {
        console.error('Data preparation failed:', err);
      }
    }
  };
  
  const navigateToWriting = () => {
    // Prepare data for writing page if needed
    if (typeof window !== 'undefined') {
      try {
        const writingData = {
          topic: 'Sample Writing Topic',
          prompt: 'Write about your favorite hobby',
          timestamp: Date.now()
        };
        localStorage.setItem('writingPrompt', JSON.stringify(writingData));
      } catch (err) {
        console.error('Data preparation failed:', err);
      }
    }
  };
  
  const navigateToVocab = () => {
    // Prepare vocabulary data
    if (typeof window !== 'undefined') {
      try {
        // Get vocabulary word data
        const vocabData = {
          word: 'ubiquitous',
          definition: 'Present, appearing, or found everywhere',
          partOfSpeech: 'adjective',
          timestamp: Date.now() // Add timestamp to make object unique
        };
        
        // Save to localStorage to pass the data
        localStorage.setItem('vocabWord', JSON.stringify(vocabData));
      } catch (err) {
        console.error('Data preparation failed:', err);
      }
    }
  };

  // Handle leaving the room
  const handleLeave = () => {
    console.log('Leaving the room - no redirect');
    // Disable microphone
    disableMicrophone();
    
    // Properly close the room connection if it exists
    if (roomRef.current) {
      try {
        console.log('Disconnecting room in handleLeave');
        roomRef.current.disconnect(true);
        roomRef.current = null;
      } catch (err) {
        console.error('Error disconnecting room:', err);
      }
    }
  };

  // Start heartbeat to keep the microphone active
  const startHeartbeat = () => {
    console.log('Starting heartbeat');
    setHeartbeatActive(true);
    
    // Clear any existing heartbeat first
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    
    // Set up a heartbeat interval to keep the connection alive
    heartbeatRef.current = setInterval(() => {
      console.log('Heartbeat: maintaining microphone connection');
      if (roomRef.current && roomRef.current.localParticipant) {
        // Just log status - no need to toggle mic
        console.log('Microphone status:', roomRef.current.localParticipant.isMicrophoneEnabled);
      }
    }, 30000); // Every 30 seconds
  };
  
  // Stop the heartbeat
  const stopHeartbeat = () => {
    console.log('Stopping heartbeat');
    setHeartbeatActive(false);
    
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };
  
  // Function to set the room reference when LiveKit session creates it
  const handleRoomCreated = (room: Room) => {
    console.log('Room reference received from LiveKit session');
    
    // Store the room reference
    roomRef.current = room;
    console.log('Room reference set successfully, room object:', { 
      name: room.name, 
      numParticipants: room.numParticipants,
      hasLocalParticipant: !!room.localParticipant
    });
    
    // Set up listeners for participant events with enhanced logging
    room.on('participantConnected', (participant) => {
      console.log(`Participant connected: ${participant.identity}`, {
        metadata: participant.metadata,
        tracks: Array.from(participant.trackPublications.values()).map(t => t.kind)
      });
      
      // Check if this is the avatar agent
      if (participant.identity === 'tavus-avatar-agent') {
        console.log('🎯 TAVUS AVATAR AGENT JOINED THE ROOM!');
        
        // Get all tracks from the Tavus avatar
        const tracks = Array.from(participant.trackPublications.values());
        console.log('Tavus avatar tracks:', tracks.map(t => ({
          kind: t.kind,
          source: t.source,
          trackName: t.trackName
        })));
      }
    });
    
    room.on('participantDisconnected', (participant) => {
      console.log(`Participant disconnected: ${participant.identity}`);
    });
    
    room.on('trackSubscribed', (track, publication, participant) => {
      console.log(`Track subscribed: ${track.kind} from ${participant.identity}`, {
        trackSid: publication.trackSid,
        trackName: publication.trackName,
        source: publication.source
      });
      
      // If this is a video track from the tavus agent, log it prominently
      if (participant.identity === 'tavus-avatar-agent' && track.kind === 'video') {
        console.log('🎬 TAVUS AVATAR VIDEO TRACK SUBSCRIBED!');
        
        // If we have a video track from the avatar, try to refresh the UI
        setTimeout(() => {
          // Force a state update to ensure the avatar display re-renders
          setMicrophoneEnabled(prev => prev);
        }, 1000);
      }
    });
    
    room.on('trackUnsubscribed', (track, publication, participant) => {
      console.log(`Track unsubscribed: ${track.kind} from ${participant.identity}`);
    });
  };

  // Initialize microphone right after room is created
  useEffect(() => {
    // If room is available and microphone was previously enabled, reconnect it
    if (roomRef.current && microphoneEnabled) {
      console.log('Room reference available, re-enabling microphone');
      enableMicrophoneInRoom();
    }
  }, [roomRef.current]); // Only run when roomRef changes
  
  // Toggle microphone with improved debugging and error handling
  const toggleMicrophone = async () => {
    try {
      console.log('Toggling microphone:', !microphoneEnabled);
      
      if (!microphoneEnabled) {
        // User wants to turn microphone ON - first update the UI state
        // to provide immediate feedback
        setMicrophoneEnabled(true);
        
        try {
          // Safety check for browser compatibility
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('BrowserNotSupported');
          }
          
          // Request microphone permission
          console.log('Requesting microphone permission...');
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('Microphone permission granted, stream tracks:', stream.getTracks().length);
          
          // Stop the local tracks as LiveKit will manage them
          stream.getTracks().forEach(track => track.stop());
          
          // Check if room is initialized properly
          if (!roomRef.current) {
            console.log('Room not initialized yet, waiting for LiveKit connection...');
            // Don't retry on a timer, just wait for the useEffect to trigger
            // when roomRef.current becomes available
            return;
          }
          
          // Enable the microphone in LiveKit room
          await enableMicrophoneInRoom();
        } catch (err) {
          // Log and handle the error
          console.error('Error enabling microphone:', err);
          // Revert the UI state since we failed to enable the mic
          setMicrophoneEnabled(false);
          
          // Provide user-friendly error messages
          handleMicrophoneError(err);
        }
      } else {
        // User wants to turn microphone OFF
        disableMicrophone();
      }
    } catch (err) {
      console.error('Unexpected error in toggleMicrophone:', err);
      // Reset UI to a safe state
      setMicrophoneEnabled(false);
    }
  };
  
  // Helper function to enable microphone in the LiveKit room
  const enableMicrophoneInRoom = async () => {
    try {
      if (!roomRef.current) {
        console.error('Room reference is not available');
        return false;
      }
      
      // Log participants to debug Tavus avatar connection
      console.log(`Room has ${roomRef.current.numParticipants} participants`);
      
      // Print remote participants to check for tavus-avatar-agent
      const remoteParticipants = roomRef.current.remoteParticipants;
      console.log('Remote participants:', Array.from(remoteParticipants.keys()));
      
      // Check specifically for the tavus-avatar-agent
      const tavusAgent = remoteParticipants.get('tavus-avatar-agent');
      if (tavusAgent) {
        console.log('Tavus avatar agent is connected!');
        // Log published tracks from the Tavus agent
        const tracks = Array.from(tavusAgent.trackPublications.values());
        console.log('Tavus tracks:', tracks.map(track => ({
          kind: track.kind,
          source: track.source,
          trackName: track.trackName
        })));
      } else {
        console.log('Tavus avatar agent is not yet connected');
      }
      
      await roomRef.current.localParticipant.setMicrophoneEnabled(true);
      console.log('Microphone enabled in LiveKit room');
      
      // Start heartbeat to keep connection active
      console.log('Microphone enabled in LiveKit successfully');
      startHeartbeat();
      return true;
    } catch (err) {
      console.error('Failed to enable microphone in room:', err);
      return false;
    }
  };
  
  // Helper function to disable microphone
  const disableMicrophone = () => {
    setMicrophoneEnabled(false);
    stopHeartbeat();
    
    if (roomRef.current && roomRef.current.localParticipant) {
      console.log('Disabling microphone in LiveKit room');
      roomRef.current.localParticipant.setMicrophoneEnabled(false)
        .catch(err => console.error('Error disabling microphone:', err));
    }
  };
  
  // Helper function to handle microphone errors
  const handleMicrophoneError = (err: unknown) => {
    if (err instanceof DOMException) {
      // Browser media errors
      switch (err.name) {
        case 'NotAllowedError':
          alert('Microphone access was denied. Please allow microphone access in your browser settings.');
          break;
        case 'NotFoundError':
          alert('No microphone was found. Please connect a microphone and try again.');
          break;
        case 'NotReadableError':
          alert('Your microphone is busy or unavailable. Please close other applications that might be using it.');
          break;
        case 'OverconstrainedError':
          alert('Cannot satisfy the audio constraints specified.');
          break;
        case 'AbortError':
          alert('Microphone access was aborted. Please try again.');
          break;
        default:
          alert(`Microphone error: ${err.name}. Please try again.`);
      }
    } else if (err instanceof Error) {
      // Custom or JavaScript errors
      if (err.message === 'BrowserNotSupported') {
        alert('Your browser does not support microphone access. Please try another browser.');
      } else {
        alert(`There was a problem accessing your microphone: ${err.name || 'Unknown error'}. Please try again.`);
      }
    } else {
      // Unknown error type
      alert('There was a problem accessing your microphone. Please try again.');
    }
  };

  // Navigation items data
  const navItems = [
    { active: true, icon: "/dashboard.svg", alt: "Dashboard" },
    { active: false, icon: "/frame-1.svg", alt: "Frame 1" },
    { active: false, icon: "/frame.svg", alt: "Frame" },
    { active: false, icon: "/reference-material.svg", alt: "Reference Material" },
    { active: false, icon: "/frame-3.svg", alt: "Frame 3" },
  ];



  return (
    <div className="bg-white flex flex-col w-full relative min-h-screen">
      {/* Large and prominent microphone button at the top of the page */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={toggleMicrophone}
          className={`flex items-center justify-center p-4 ${microphoneEnabled ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded-full shadow-lg transition-all duration-200`}
          title={microphoneEnabled ? 'Turn off microphone' : 'Turn on microphone'}
        >
          <div className="flex items-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              {microphoneEnabled && (
                <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2"></line>
              )}
            </svg>
            <span className="ml-2 font-medium hidden md:inline">{microphoneEnabled ? 'Mute' : 'Talk to Rox'}</span>
          </div>
        </button>
        {/* Status indicator */}
        <div className="text-center mt-1 text-xs">
          <span className={`${microphoneEnabled ? 'text-green-500' : 'text-gray-500'}`}>
            {microphoneEnabled ? 'Microphone active' : ''}
          </span>
        </div>
      </div>
      
      {/* LiveKit status indicator */}
      <div className="fixed top-5 left-5 z-50">
        <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-md text-sm shadow-sm border border-blue-100">
          LiveKit Active {microphoneEnabled ? '• Mic On' : ''}
        </div>
      </div>
      
      {/* Fixed User Status Button with enhanced interaction */}
      <div className="fixed top-20 left-5 z-50">
        {/* Extra debug section */}
        <div className="mb-2 p-2 bg-black text-white text-xs rounded">
          Status: {showUserStatus ? 'VISIBLE' : 'HIDDEN'} | Token: {userToken ? 'LOADED' : 'MISSING'}
        </div>
        
        {/* Using regular anchor tag as fallback */}
        <a 
          href="#" 
          onClick={(e) => {
            e.preventDefault();
            console.log('CLICK DETECTED');
            toggleUserStatus();
          }}
          className="block cursor-pointer select-none px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xl font-bold rounded-md hover:from-purple-500 hover:to-blue-500 transition-all duration-300 border-4 border-white shadow-xl active:scale-95 text-center"
        >
          {showUserStatus ? '❌ HIDE SKILLS' : '🌟 SHOW MY SKILLS 🌟'}
        </a>
        
        {/* Always show this as a fallback test option */}
        <button
          className="mt-2 w-full px-4 py-2 bg-red-500 text-white rounded"
          onClick={toggleUserStatus}
        >
          BACKUP TOGGLE BUTTON
        </button>
        
        {/* User Status Component with explicit conditional rendering */}
        {showUserStatus ? (
          <div className="mt-2 border-4 border-blue-300 rounded-lg p-6 bg-white shadow-xl overflow-auto max-h-[600px]" style={{ minWidth: '350px' }}>
            <h2 className="text-xl font-bold text-blue-600 mb-4 text-center">YOUR LANGUAGE SKILLS</h2>
            <UserStatus token={userToken} />
          </div>
        ) : null}
      </div>
      
      <div className="bg-white overflow-hidden w-[1440px] h-[820px]">
        <div className="relative w-[2012px] h-[1284px] top-[-359px] -left-36">
            {/* Background decorative elements with lower z-index to stay behind content */}
            <div className="absolute w-[753px] h-[753px] top-0 left-[1259px] bg-[#566fe9] rounded-[376.5px] z-[-1]" />
            <div className="absolute w-[353px] h-[353px] top-[931px] left-0 bg-[#336de6] rounded-[176.5px] z-[-1]" />
            <div className="absolute w-[1440px] h-[820px] top-[359px] left-36 bg-[#ffffff99] backdrop-blur-[200px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(200px)_brightness(100%)] z-[0]" />
            
            {/* Single centralized circular Tavus avatar display */}
            <div className="absolute top-[300px] left-0 right-0 z-[50] flex flex-col items-center justify-center">
              <div className="text-center mb-4 bg-white px-4 py-2 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-blue-600">Tavus Avatar</h2>
                <p className="text-sm">Ask me anything using your microphone</p>
              </div>
              
              <div className="flex flex-col items-center space-y-4">
                {/* Hidden LiveKit session for audio connection only */}
                <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0, zIndex: -1 }}>
                  <LiveKitSession
                    roomName={roomName}
                    userName={userName || 'Guest User'}
                    sessionTitle="Conversation with Rox"
                    onLeave={() => {
                      console.log('LiveKit session ended');
                      setMicrophoneEnabled(false);
                    }}
                    pageType="rox"
                    hideVideo={true} /* Hide all video tracks from LiveKitSession */
                    hideAudio={false} /* Keep audio enabled for voice communication */
                    aiAssistantEnabled={true} /* Keep AI agent enabled for conversation */
                    showAvatar={false} /* Critical: Disable avatar in LiveKitSession to prevent duplicate */
                    onRoomCreated={handleRoomCreated}
                  />
                </div>
                
                {/* Avatar display container */}
                <div className="relative overflow-hidden bg-black rounded-lg shadow-xl" 
                     style={{
                       width: '100%', 
                       maxWidth: '600px', 
                       height: '400px', 
                       margin: '0 auto',
                       border: '2px solid #566FE9',
                     }}>
                  {roomRef.current ? (
                    <SimpleTavusDisplay room={roomRef.current} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-white">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                      <p>Initializing Rox AI Avatar...</p>
                      <p className="mt-2 text-xs text-blue-300">Setting up video connection</p>
                    </div>
                  )}
                  
                  {/* Status badge */}
                  <div className="absolute top-2 right-2 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-semibold z-10">
                    Rox AI
                  </div>
                </div>
              </div>
            </div>

          {/* Sidebar navigation */}
          <div className="inline-flex flex-col h-[820px] items-center justify-between px-2 py-3.5 absolute top-[359px] left-36">
            {/* Logo */}
            <div className="flex w-[28.1px] h-7 items-start gap-[0.47px] px-[2.38px] py-0 relative">
              <Image
                className="relative w-[23.29px] h-7"
                alt="Final logo"
                src="/final-logo.png"
                width={24}
                height={28}
              />
            </div>

            {/* Navigation icons */}
            <div className="inline-flex flex-col items-start gap-3 relative flex-[0_0_auto]">
              {navItems.map((item, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="icon"
                  className={`inline-flex items-center gap-3 p-2 relative flex-[0_0_auto] rounded-md ${item.active ? "bg-[#566fe9]" : ""}`}
                >
                  <Image
                    className="relative w-6 h-6"
                    alt={item.alt}
                    src={item.icon}
                    width={24}
                    height={24}
                  />
                </Button>
              ))}
            </div>

            {/* Invisible spacer element */}
            <div className="flex w-[28.1px] h-7 items-start gap-[0.47px] px-[2.38px] py-0 relative opacity-0">
              <Image
                className="relative w-[23.29px] h-7"
                alt="Final logo"
                src="/final-logo-1.png"
                width={24}
                height={28}
              />
            </div>
          </div>

          {/* Removed duplicate avatar display - we're now only using the main circular container above */}

          {/* AI Assistant greeting with user progress */}
          <div className="absolute w-[700px] top-[792px] left-[542px] font-semibold text-black text-lg text-center leading-normal">
            {loading ? (
              "Loading your personalized content..."
            ) : error ? (
              error
            ) : (
              <>
                Hello {userName || 'there'}. I am Rox, your AI Assistant!
                {userProgress && userProgress.length > 0 && (
                  <div className="mt-2 text-sm font-normal">
                    You've completed {userProgress.length} learning tasks. {nextTask ? "Let's continue your journey!" : "Great job!"}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Suggestion cards */}


          {/* Input area */}
          <div className="inline-flex items-center gap-3 absolute top-[830px] left-[542px]" style={{width: '800px', left: '152px', transform: 'translateX(390px)'}}>
            <div className="flex w-[592px] h-12 items-center justify-between pl-4 pr-2 py-5 relative rounded-md border border-solid border-[#566fe933]">
              <Input
                className="border-none shadow-none focus-visible:ring-0 opacity-40 font-normal text-black text-sm leading-normal whitespace-nowrap"
                placeholder="Ask me anything!"
              />
              <Button
                size="sm"
                className="inline-flex items-center gap-2.5 p-2 relative flex-[0_0_auto] mt-[-12.00px] mb-[-12.00px] bg-[#566fe9] rounded"
                onClick={() => {}}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M22 2L11 13"></path>
                  <path d="M22 2L15 22L11 13L2 9L22 2Z"></path>
                </svg>
              </Button>
            </div>

            {/* Video call button removed since LiveKit is now displayed by default */}
          </div>
          
          {/* Rox AI Assistant with microphone button */}
          <div className="assistant-container mt-6" style={{maxWidth: "800px", margin: "24px auto"}}>
            <div className="h-full flex flex-col items-center justify-center"> {/* Added items-center and justify-center */}
              <div className="dashboard-greeting mb-6">
                <h1 className="text-3xl font-bold text-[#566FE9] dark:text-blue-400">Hello, {userName || 'Friend'}</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Welcome to your personalized language dashboard.</p>
                
                {/* Button removed and moved to fixed position at top of page */}
              </div>
              <div className="static top-0 w-full text-center py-4"> {/* Simplified and centered text */}
                <h1 className="text-2xl font-bold text-[#566FE9] mb-2">ROX</h1>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Rox AI Assistant</h3>
                <p className="text-gray-600 mb-4">Your AI voice assistant is ready to help.</p>
                
                {/* Avatar display container */}
                <div className="avatar-display-container" style={{ width: "100%", maxWidth: "400px", height: "300px", margin: "0 auto", borderRadius: "12px", overflow: "hidden" }}>
                  {roomRef.current && (
                    <SimpleTavusDisplay room={roomRef.current} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Floating microphone control button */}
        <div style={{
          position: "fixed", 
          bottom: "20px", 
          right: "20px",
          zIndex: 10
        }}>
          <Button 
            size="lg"
            onClick={toggleMicrophone} 
            className={`rounded-full p-4 shadow-lg ${microphoneEnabled ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            </svg>
          </Button>
        </div>
        
        {/* LiveKitSession is now integrated directly into the avatar display */}
      </div>
    </div>
  );
}

export default function RoxPage() {
  // Completely standalone page with no redirects or authentication checks
  return <RoxPageContent />;
}