"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import LiveKitSession from "@/components/LiveKitSession";
import { Room } from 'livekit-client';

interface LiveKitSessionData {
  roomName: string;
  livekitAccessToken: string;
  livekitServerUrl: string;
  userName: string;
}

export default function NewSessionPage() {
  console.log("[NewSessionPage] Component mounted");
  const [sessionData, setSessionData] = useState<LiveKitSessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [isAudioInitializing, setIsAudioInitializing] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [audioPermissionError, setAudioPermissionError] = useState<string | null>(null);
  const [disconnectedByUser, setDisconnectedByUser] = useState(false);

  const fetchSessionDetails = useCallback(async () => {
    console.log("[NewSessionPage] fetchSessionDetails started");
    setIsLoading(true);
    setFetchError(null);
    setSessionData(null);
    setIsAudioReady(false);
    setIsAudioInitializing(false);
    setAudioPermissionError(null);
    console.log("[NewSessionPage] isLoading set to true, states reset for new fetch.");

    const TEST_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI5ODRiMGEyMi1lZmYyLTRhZTUtOGYyMC03NGVkYTA3MjNjZmEiLCJpYXQiOjE3NDkxMTQ5MjV9._Q8NyBSBJ-DQRdRyWajZStqsZgnu4jlj6APlw5UusWo"; 
    let USER_ID_FOR_USERNAME = 'newSessionUser';
    try {
      const jwtPayload = TEST_JWT.split('.')[1];
      if (jwtPayload) {
        const decodedPayload = JSON.parse(atob(jwtPayload));
        if (decodedPayload && decodedPayload.userId) {
          USER_ID_FOR_USERNAME = `user-${decodedPayload.userId.substring(0,8)}`;
        }
      }
    } catch (e) {
      console.warn("[NewSessionPage] Could not parse JWT for username, using default.", e);
    }

    try {
      const response = await fetch('http://localhost:8000/api/start-ai-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_JWT}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        let errorData;
        try { errorData = await response.json(); } catch (e) { const errorText = await response.text(); errorData = { message: errorText || `HTTP error! status: ${response.status}` }; }
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("[NewSessionPage] Fetched session data from backend:", data);
      if (data.success && data.roomName && data.studentToken && data.livekitUrl) {
        setSessionData({
          roomName: data.roomName,
          livekitAccessToken: data.studentToken,
          livekitServerUrl: data.livekitUrl,
          userName: USER_ID_FOR_USERNAME, 
        });
        console.log("[NewSessionPage] sessionData state updated.");
      } else {
        console.error("[NewSessionPage] Invalid data from backend:", data);
        throw new Error(data.message || 'Failed to start AI session: Invalid data received from backend.');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[NewSessionPage] Error in fetchSessionDetails:", errorMsg, err);
      setFetchError(errorMsg);
    } finally {
      setIsLoading(false);
      console.log("[NewSessionPage] isLoading set to false after fetch attempt.");
    }
  }, []);

  useEffect(() => {
    console.log("[NewSessionPage] Initial useEffect for fetchSessionDetails triggered");
    fetchSessionDetails();
  }, [fetchSessionDetails]);

  const requestAudioPermissionsAndResumeContext = useCallback(async () => {
    if (isAudioReady || isAudioInitializing) return; // Don't run if already ready or in progress

    console.log('[NewSessionPage] Automatically initiating audio. Requesting microphone permission...');
    setIsAudioInitializing(true);
    setAudioPermissionError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[NewSessionPage] Microphone permission granted. Stream tracks:', stream.getTracks().length);

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
        console.log('[NewSessionPage] Audio context resumed');
      }
      stream.getTracks().forEach(track => track.stop());
      handleAudioReady();
    } catch (err) {
      console.error('[NewSessionPage] Error getting microphone permission or resuming context:', err);
      const errMessage = err instanceof Error ? err.message : String(err);
      setAudioPermissionError(`Microphone permission error: ${errMessage}. Please ensure your browser has access and try again.`);
      setIsAudioInitializing(false);
      setIsAudioReady(false);
    }
  }, [isAudioReady, isAudioInitializing]);

  useEffect(() => {
    if (sessionData && !isAudioReady && !isAudioInitializing && !audioPermissionError) {
      console.log("[NewSessionPage] Session data available, automatically initiating audio permission request.");
      requestAudioPermissionsAndResumeContext();
    }
  }, [sessionData, isAudioReady, isAudioInitializing, audioPermissionError, requestAudioPermissionsAndResumeContext]);

  const handleAudioReady = () => {
    console.log("[NewSessionPage] Audio permissions granted and context resumed.");
    setIsAudioReady(true);
    setIsAudioInitializing(false);
  };

  const handleLeaveSession = useCallback((isUserTriggered = false) => {
    console.log("[NewSessionPage] onLeave triggered from LiveKitSession. User triggered:", isUserTriggered);
    // Only reset sessionData if the user intentionally disconnected, not on automatic disconnects
    if (isUserTriggered) {
      setDisconnectedByUser(true);
      setSessionData(null);
      console.log("[NewSessionPage] User initiated disconnect - session data cleared.");
    } else {
      // For automatic/unintentional disconnects, keep session data so we can reconnect
      console.log("[NewSessionPage] Automatic disconnect - preserving session data for reconnection.");
      // We don't reset sessionData here to prevent remounting
    }
    
    setIsAudioReady(false);
    setIsAudioInitializing(false);
    setAudioPermissionError(null);
    console.log("[NewSessionPage] Audio states reset after leaving session.");
  }, []);

  console.log(`[NewSessionPage] Rendering - isLoading: ${isLoading}, fetchError: ${fetchError}, sessionData: ${sessionData ? 'exists' : 'null'}, isAudioInitializing: ${isAudioInitializing}, isAudioReady: ${isAudioReady}, audioPermissionError: ${audioPermissionError}`);

  let content;
  if (isLoading) {
    content = <div style={{ padding: '20px', textAlign: 'center' }}>Loading session details...</div>;
  } else if (fetchError) {
    content = (
      <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
        <h2>Error Fetching Session</h2>
        <p>{fetchError}</p>
        <button onClick={fetchSessionDetails} style={{ display: 'block', margin: '20px auto', padding: '10px 20px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px' }}>
          Retry Fetching Session Details
        </button>
      </div>
    );
  } else if (sessionData && isAudioInitializing) { 
    content = (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        Initializing audio... Please allow microphone access if prompted.
      </div>
    );
  } else if (sessionData && audioPermissionError) { 
    content = (
      <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
        <h2>Audio Permission Error</h2>
        <p>{audioPermissionError}</p>
        <button onClick={requestAudioPermissionsAndResumeContext} style={{ display: 'block', margin: '20px auto', padding: '10px 20px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px' }}>
          Retry Audio Permissions
        </button>
      </div>
    );
  } else if (sessionData && isAudioReady) { 
    content = (
      <LiveKitSession
        roomName={sessionData.roomName}
        userName={sessionData.userName}
        livekitAccessToken={sessionData.livekitAccessToken}
        livekitServerUrl={sessionData.livekitServerUrl}
        onLeave={handleLeaveSession}
        hideVideo={true}
      />
    );
  } else {
    content = <div style={{ padding: '20px', textAlign: 'center' }}>Initializing session or no data available... Please wait or refresh.</div>;
  }

  return (
    <div className="flex h-screen bg-white text-gray-800 overflow-hidden bg-[image:radial-gradient(ellipse_at_top_right,_#B7C8F3_0%,_transparent_70%),_radial-gradient(ellipse_at_bottom_left,_#B7C8F3_0%,_transparent_70%)]">
      <aside className="w-20 p-4 flex flex-col items-center space-y-6">
        <Image src="/final-logo-1.png" alt="Logo" width={32} height={32} className="rounded-lg" />
        <div className="flex-grow flex flex-col items-center justify-center space-y-4">
          <Image src="/user.svg" alt="User Profile" width={24} height={24} className="cursor-pointer hover:opacity-75" />
          <Image src="/mic-on.svg" alt="Mic On" width={24} height={24} className="cursor-pointer hover:opacity-75" />
          <Image src="/next.svg" alt="Next" width={24} height={24} className="cursor-pointer hover:opacity-75" />
        </div>
      </aside>
      <main className="flex-1 flex flex-col items-center justify-center p-8 relative">
        {content}
      </main>
    </div>
  );
}
