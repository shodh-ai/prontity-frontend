'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LiveKitSession from '@/components/LiveKitSession';
import SpeakingTimer from '@/components/SpeakingTimer';

export default function RoxPage() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  
  // Room configuration
  const roomName = 'RoxConversation';
  
  // Example conversation prompt
  const conversationPrompt = "Hello! I'm Rox, your TOEFL practice assistant. How can I help you today? Would you like to practice speaking, writing, or review vocabulary?";
  
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

  // Navigation to other practice sections
  const navigateToSpeaking = () => router.push('/speakingpage');
  const navigateToWriting = () => router.push('/writingpage');
  const navigateToVocab = () => router.push('/vocabpage');
  
  // Handle leaving the room
  const handleLeave = () => {
    router.push('/');
  };

  // Custom controls for Rox page
  const roxPageControls = (
    <div className="rox-controls">
      <button 
        className="practice-button"
        onClick={navigateToSpeaking}
      >
        Speaking Practice
      </button>
      <button 
        className="practice-button"
        onClick={navigateToWriting}
      >
        Writing Practice
      </button>
      <button 
        className="practice-button"
        onClick={navigateToVocab}
      >
        Vocabulary Practice
      </button>
    </div>
  );

  return (
    <div className="page-wrapper">
      <LiveKitSession
        roomName={roomName}
        userName={userName || 'student-user'}
        questionText={conversationPrompt}
        sessionTitle="Conversation with Rox"
        pageType="rox"
        customControls={roxPageControls}
        onLeave={handleLeave}
        aiAssistantEnabled={true}
      />
    </div>
  );
}
