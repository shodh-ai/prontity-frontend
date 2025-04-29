'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LiveKitSession from '@/components/LiveKitSession';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useSession } from 'next-auth/react';

function RoxPageContent() {
  const router = useRouter();
  const { data: session } = useSession();
  const [userName, setUserName] = useState('');
  
  // Room configuration
  const roomName = 'RoxConversation';
  
  // Example conversation prompt
  const conversationPrompt = "Hello! I'm Rox, your TOEFL practice assistant. How can I help you today? Would you like to practice speaking, writing, or review vocabulary?";
  
  // Get username from session or localStorage when component mounts
  useEffect(() => {
    if (session?.user?.name) {
      setUserName(session.user.name);
    } else {
      const storedUserName = localStorage.getItem('userName');
      if (storedUserName) {
        setUserName(storedUserName);
      }
    }
  }, [session]);

  // Navigation to other practice sections
  const navigateToSpeaking = () => router.push('/speakingpage');
  const navigateToWriting = () => router.push('/writingpage');
  const navigateToVocab = () => router.push('/vocabpage');
  
  // Handle leaving the room
  const handleLeave = () => {
    router.push('/');
  };

  // Practice navigation buttons have been removed

  return (
    <div className="page-wrapper">
      <div className="simplified-rox-interface">
        <h2>Welcome to TOEFL Practice Assistant</h2>
        <p>{conversationPrompt}</p>
        <div className="navigation-links">
          <a href="/speakingpage" onClick={() => router.push('/speakingpage')}>Speaking Practice</a>
          <a href="/writingpage" onClick={() => router.push('/writingpage')}>Writing Practice</a>
          <a href="/vocabpage" onClick={() => router.push('/vocabpage')}>Vocabulary Practice</a>
        </div>
      </div>
    </div>
  );
}

export default function RoxPage() {
  return (
    <ProtectedRoute>
      <RoxPageContent />
    </ProtectedRoute>
  );
}
