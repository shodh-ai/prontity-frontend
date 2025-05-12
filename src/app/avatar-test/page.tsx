'use client';

import React, { useState, useEffect } from 'react';
import LiveKitSession from '@/components/LiveKitSession';
import '@/styles/enhanced-room.css';

export default function AvatarTestPage() {
  const [userData, setUserData] = useState<{name?: string, email?: string} | null>(null);
  const [showLiveKit, setShowLiveKit] = useState(false);
  
  // For LiveKit session - using a dedicated test room
  const roomName = "AvatarTest";
  const userName = userData?.name || "TestUser";

  // Load user data if available
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      setUserData(JSON.parse(user));
    }
  }, []);

  // Toggle LiveKit session visibility
  const toggleLiveKit = () => {
    setShowLiveKit(!showLiveKit);
  };

  // Handle leaving the LiveKit session
  const handleLiveKitLeave = () => {
    setShowLiveKit(false);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-3xl font-bold mb-6 text-center">Tavus Avatar Test Page</h1>
      
      <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-8">
        <div className="bg-purple-600 text-white p-6">
          <h2 className="text-xl font-semibold">Avatar Testing Environment</h2>
          <p className="mt-2 text-purple-100">
            This page is dedicated to testing the Tavus avatar integration in LiveKit.
          </p>
        </div>
        
        <div className="p-6">
          <div className="flex flex-col space-y-4">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <p className="text-yellow-700">
                <strong>Important:</strong> Make sure the LiveKit agent is running with avatar support:
              </p>
              <pre className="mt-2 bg-gray-100 p-2 rounded text-sm overflow-x-auto">
                python main.py connect --room AvatarTest --avatar-enabled true
              </pre>
            </div>

            <h3 className="text-lg font-medium mt-4">Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium">Room Name</h4>
                <p className="text-gray-700">{roomName}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium">User Name</h4>
                <p className="text-gray-700">{userName}</p>
              </div>
            </div>
            
            <div className="mt-6">
              <button 
                onClick={toggleLiveKit}
                className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                {showLiveKit ? 'Hide LiveKit Session' : 'Start LiveKit Session with Avatar'}
              </button>
            </div>
          </div>
          
          {showLiveKit && (
            <div className="mt-6 border rounded-lg overflow-hidden">
              <div className="bg-blue-50 p-3 text-xs">
                <div className="font-semibold">Debug Console:</div>
                <div id="debug-output" className="font-mono text-xs max-h-20 overflow-auto p-1 bg-black text-green-400">
                  Waiting for video tracks...
                </div>
                <script dangerouslySetInnerHTML={{ __html: `
                  // Debug script to monitor for video tracks
                  const debugOutput = document.getElementById('debug-output');
                  function log(msg) {
                    const time = new Date().toLocaleTimeString();
                    debugOutput.innerHTML += '\n' + time + ': ' + msg;
                    debugOutput.scrollTop = debugOutput.scrollHeight;
                  }
                  
                  // Monitor for video elements created
                  const observer = new MutationObserver(mutations => {
                    mutations.forEach(mutation => {
                      mutation.addedNodes.forEach(node => {
                        if (node.nodeName === 'VIDEO') {
                          log('Video element detected! src=' + (node.src || 'none'));
                          log('Video dimensions: ' + node.width + 'x' + node.height);
                        }
                      });
                    });
                  });
                  
                  // Start observing
                  setTimeout(() => {
                    observer.observe(document.body, { childList: true, subtree: true });
                    log('Started monitoring for video elements');
                  }, 500);
                ` }} />
              </div>
              <LiveKitSession
                roomName={roomName}
                userName={userName}
                sessionTitle="Tavus Avatar Testing"
                pageType="speaking"
                onLeave={handleLiveKitLeave}
                questionText="Test the avatar by speaking to it. Ask questions or give it instructions."
                aiAssistantEnabled={true}
                showAvatar={true} /* Enable Tavus avatar display */
              />
            </div>
          )}
        </div>
      </div>
      
      <div className="p-6 bg-white shadow-lg rounded-lg">
        <h3 className="text-lg font-medium mb-4">Avatar Debugging Information</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium">Test Instructions:</h4>
            <ol className="list-decimal list-inside space-y-2 mt-2">
              <li>Start the LiveKit agent with avatar enabled</li>
              <li>Click the "Start LiveKit Session with Avatar" button above</li>
              <li>Check if the avatar appears in the video panel</li>
              <li>Try speaking to the avatar and observe its responses</li>
              <li>Check browser console for any errors</li>
            </ol>
          </div>
          
          <div className="bg-gray-50 p-4 rounded border">
            <h4 className="font-medium">Expected Behavior:</h4>
            <p className="mt-2">
              The Tavus avatar should appear in the video panel when the LiveKit session starts.
              The avatar should animate and speak in response to your input.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
