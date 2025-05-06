'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import LiveKitSession from '@/components/LiveKitSession';
import SpeakingTimer from '@/components/SpeakingTimer';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useSession } from 'next-auth/react';

// Import API clients
import contentApi from '@/api/contentService';
import userProgressApi from '@/api/userProgressService';

function SpeakingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [showTimerNotification, setShowTimerNotification] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [topic, setTopic] = useState<{
    topicId: string;
    title: string;
    promptText: string;
    difficultyLevel?: number | null;
  } | null>(null);
  
  // Room configuration
  const roomName = 'Speakingpage';
  
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
  
  // Load a speaking topic from the Content Service API
  useEffect(() => {
    const fetchSpeakingTopic = async () => {
      setLoading(true);
      setError(null);
      try {
        // Get topic ID from URL query parameters if available
        const topicIdFromUrl = searchParams?.get('topicId');
        
        // Default topic IDs from the API documentation
        const availableTopicIds = ['topic-daily-routine', 'topic-climate-change', 'topic-technology'];
        
        // Use the topic ID from URL or default to the first in our list
        const targetTopicId = topicIdFromUrl || availableTopicIds[0];
        
        // Fetch the speaking topic from the content service
        const topicData = await contentApi.getSpeakingTopic(targetTopicId);
        setTopic(topicData);
        
      } catch (err) {
        console.error('Error fetching speaking topic:', err);
        setError('Failed to load speaking topic. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSpeakingTopic();
  }, [searchParams]);
  
  // Function to load a different speaking topic
  const loadNewTopic = () => {
    // Available topic IDs from the API documentation
    const availableTopicIds = ['topic-daily-routine', 'topic-climate-change', 'topic-technology'];
    
    // Get a random topic ID different from the current one
    const currentTopicId = topic?.topicId;
    const availableIds = availableTopicIds.filter(id => id !== currentTopicId);
    const randomIndex = Math.floor(Math.random() * availableIds.length);
    const newTopicId = availableIds[randomIndex];
    
    // Navigate to the same page with a new topic ID
    router.push(`/speakingpage?topicId=${newTopicId}`);
  };
  
  // Handle leaving the room
  const handleLeave = () => {
    // Record task completion with the user progress service if logged in
    try {
      const token = localStorage.getItem('token');
      if (token && topic) {
        userProgressApi.recordTaskCompletion(
          topic.topicId, // using topicId as taskId
          100, // score (arbitrary for now)
          { speakingCompleted: true },
          undefined, // no SRS for speaking
          true
        );
      }
    } catch (err) {
      console.error('Error recording task completion:', err);
    }
    
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
      
      {/* Topic refresh button */}
      <button 
        onClick={loadNewTopic}
        className="fixed top-4 right-4 z-50 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md shadow-lg transition-colors duration-200"
      >
        New Topic
      </button>
      
      {loading ? (
        <div className="flex items-center justify-center h-screen w-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4">Loading speaking topic...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-screen w-full">
          <div className="text-center bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md">
            <p className="font-bold">Error loading speaking topic</p>
            <p>{error}</p>
            <button 
              onClick={loadNewTopic} 
              className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
            >
              Try Again
            </button>
          </div>
        </div>
      ) : topic ? (
        <LiveKitSession
          roomName={roomName}
          userName={userName || 'student-user'}
          questionText={topic.promptText}
          sessionTitle={`Speaking Practice: ${topic.title}`}
          onLeave={handleLeave}
        />
      ) : (
        <div className="flex items-center justify-center h-screen w-full">
          <div className="text-center">
            <p>No speaking topic available</p>
            <button 
              onClick={loadNewTopic} 
              className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <ProtectedRoute>
      <SpeakingPageContent />
    </ProtectedRoute>
  );
}
