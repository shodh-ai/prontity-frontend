'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LiveKitSession from '@/components/LiveKitSession';
import SpeakingTimer from '@/components/SpeakingTimer';

export default function WritingPage() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [essay, setEssay] = useState('');
  const [showTimerNotification, setShowTimerNotification] = useState(false);
  
  // Room configuration
  const roomName = 'WritingPractice';
  
  // The writing prompt
  const writingPrompt = "Some people believe that university students should be required to attend classes. Others believe that going to classes should be optional for students. Which point of view do you agree with? Use specific reasons and details to explain your answer.";
  
  // Get username from localStorage when component mounts
  useEffect(() => {
    const storedUserName = localStorage.getItem('userName');
    if (storedUserName) {
      setUserName(storedUserName);
    } else {
      // Redirect to login if no username found
      router.push('/loginpage');
    }
  }, [router]);

  // Handle leaving the room
  const handleLeave = () => {
    router.push('/roxpage');
  };
  
  // Handle timer end
  const handleTimerEnd = () => {
    setShowTimerNotification(true);
    // Hide notification after 5 seconds
    setTimeout(() => {
      setShowTimerNotification(false);
    }, 5000);
  };

  // Custom writing area component
  const WritingArea = () => (
    <div className="writing-area-container">
      <textarea
        className="writing-textarea"
        value={essay}
        onChange={(e) => setEssay(e.target.value)}
        placeholder="Start writing your essay here..."
        style={{
          width: '100%',
          minHeight: '300px',
          padding: '12px',
          borderRadius: '8px',
          border: '1px solid #ccc',
          fontSize: '16px',
          lineHeight: '1.5'
        }}
      />
      <div className="word-count" style={{ marginTop: '8px', textAlign: 'right' }}>
        Word count: {essay.split(/\s+/).filter(Boolean).length}
      </div>
    </div>
  );

  return (
    <div className="page-wrapper">
      {/* Floating timer component positioned at the top center */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
        <SpeakingTimer 
          initialSeconds={1800} // 30 minutes
          onTimerEnd={handleTimerEnd}
          className="bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-lg" 
        />
      </div>
      
      {/* Timer ended notification */}
      {showTimerNotification && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-md shadow-lg animate-pulse">
          Time's up! Please finalize your essay.
        </div>
      )}

      <LiveKitSession
        roomName={roomName}
        userName={userName || 'student-user'}
        questionText={writingPrompt}
        sessionTitle="Writing Practice"
        pageType="writing"
        customControls={<WritingArea />}
        onLeave={handleLeave}
        hideVideo={true} // Often no video needed for writing practice
        aiAssistantEnabled={true}
      />
    </div>
  );
}
