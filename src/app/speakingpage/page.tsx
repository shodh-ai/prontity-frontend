'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import LiveKitSession from '@/components/LiveKitSession';
import SpeakingTimer from '@/components/SpeakingTimer';

export default function Page() {
  const router = useRouter();
  const [showTimerNotification, setShowTimerNotification] = useState(false);
  
  // Room configuration
  const roomName = 'Speakingpage';
  const userName = 'quickstart-user';
  
  // The practice question for this specific room
  const questionText = "With the rise of automation and artificial intelligence, there is a growing concern about the future of jobs and the relevance of traditional education. What measures do you think should be taken to ensure that education remains effective in preparing individuals for the workforce?";
  
  // Handle leaving the room
  const handleLeave = () => {
    router.push('/');
  };
  
  // Handle timer end
  const handleTimerEnd = () => {
    setShowTimerNotification(true);
    // Hide notification after 5 seconds
    setTimeout(() => {
      setShowTimerNotification(false);
    }, 5000);
  };

  return (
    <div className="page-wrapper">
      {/* Floating timer component positioned at the top center */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
        <SpeakingTimer 
          initialSeconds={45} 
          onTimerEnd={handleTimerEnd}
          className="bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-lg" 
        />
      </div>
      
      {/* Timer ended notification */}
      {showTimerNotification && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-md shadow-lg animate-pulse">
          Time's up! Please conclude your answer.
        </div>
      )}
      
      <LiveKitSession
        roomName={roomName}
        userName={userName}
        questionText={questionText}
        sessionTitle="Speaking Practice Session"
        onLeave={handleLeave}
      />
    </div>
  );
}
