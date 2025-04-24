'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LiveKitSession from '@/components/LiveKitSession';

export default function VocabPage() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  
  // Room configuration
  const roomName = 'VocabularyPractice';
  
  // Example vocabulary task instructions
  const vocabInstructions = "In this vocabulary practice, we'll review key academic terms that frequently appear in TOEFL exams. You can draw, define, or practice using these words in context.";
  
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

  // Canvas component placeholder (you'd implement your actual canvas component here)
  const CanvasComponent = () => (
    <div className="vocab-canvas-container">
      <div className="canvas-area" style={{ 
        width: '100%', 
        height: '400px', 
        border: '1px solid #ccc',
        borderRadius: '8px',
        backgroundColor: '#f9f9f9',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <p>Canvas Component for Vocabulary Practice</p>
        <p>(Your CanvasComponent implementation would go here)</p>
      </div>
      <div className="canvas-controls" style={{ marginTop: '15px' }}>
        <button className="control-button">Clear Canvas</button>
        <button className="control-button">Save Work</button>
        <button className="control-button">Next Word</button>
      </div>
    </div>
  );

  return (
    <div className="page-wrapper">
      <LiveKitSession
        roomName={roomName}
        userName={userName || 'student-user'}
        questionText={vocabInstructions}
        sessionTitle="Vocabulary Practice"
        pageType="vocab"
        hideVideo={true} // No video needed for vocab practice
        customControls={<CanvasComponent />}
        onLeave={handleLeave}
        aiAssistantEnabled={true}
      />
    </div>
  );
}
