'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import QuestionSection from './QuestionSection';
import TimerSection from './TimerSection';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useSession } from 'next-auth/react';
import LiveKitSession from '@/components/LiveKitSession';

// Import API clients
import contentApi from '@/api/contentService';
import userProgressApi from '@/api/userProgressService';

// Import styles
import '../figma-styles.css';
import '@/styles/enhanced-room.css';

export default function Page() {
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
  const [wordCount, setWordCount] = useState(0);
  const [timerEnded, setTimerEnded] = useState(false);
  
  // Room configuration
  const roomName = 'SpeakingPractice';

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
    router.push(`/speakingpage/practice-session?topicId=${newTopicId}`);
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
    setTimerEnded(true);
    setShowTimerNotification(true);
  };

  return (
    <div className="figma-room-container">
      {/* Background blur overlay */}
      <div className="figma-backdrop"></div>
      
      {/* Main content area */}
      <div className="figma-content">
        {loading ? (
          <div className="flex items-center justify-center h-full w-full">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Loading...</h2>
              <div className="flex justify-center">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full w-full">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
              <h2 className="text-2xl font-semibold text-red-600 mb-4">Error</h2>
              <p className="text-gray-700 mb-6">{error}</p>
              <div className="flex justify-center">
                <button
                  onClick={() => router.push('/roxpage')}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-md transition-colors"
                >
                  Return to Home
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative h-full w-full">
            {/* Header with title */}
            <div className="absolute top-[32px] left-[152px] flex items-center space-x-2">
              <h1 className="text-[28px] font-semibold text-[#222222]">
                {topic?.title || 'Speaking Practice'}
              </h1>
            </div>
            
            {/* Question Section */}
            <div className="figma-question-container">
              <h3 className="text-base font-medium text-[#222222]">Question:</h3>
              <div className="p-4 bg-white rounded-[10px] shadow-sm w-[800px]">
                <p className="text-[17px] text-[#222222]">{topic?.promptText || ''}</p>
              </div>
            </div>
            
            {/* Timer Section - positioned in the upper left according to Figma design */}
            <div className="absolute top-[80px] right-[80px] bg-white py-2 px-4 rounded-lg shadow-sm">
              <TimerSection 
                onTimerEnd={handleTimerEnd} 
                initialSeconds={120} 
              />
            </div>
            
            {/* LiveKit Integration */}
            <div className="absolute left-[152px] top-[320px] w-[800px] h-[328px] bg-white rounded-[10px] shadow-md overflow-hidden">
              {topic && (
                <LiveKitSession
                  roomName={roomName}
                  userName={userName || 'User'}
                  questionText={topic?.promptText || ''}
                  sessionTitle={topic?.title || 'Speaking Practice'}
                  onLeave={handleLeave}
                  pageType="speakingpage"
                  showTimer={true}
                  timerDuration={120}
                  customControls={
                    <button 
                      onClick={loadNewTopic} 
                      className="w-12 h-12 rounded-md border border-[#566fe9] flex items-center justify-center hover:bg-blue-50 transition-colors"
                      title="Load new topic"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M23 4v6h-6" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M1 20v-6h6" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  }
                />
              )}
              
              {/* Word Count Display - overlay on the bottom of the LiveKit window */}
              <div className="absolute bottom-4 right-4 bg-white/90 py-1 px-3 rounded-full shadow-sm">
                <span className="text-sm font-medium text-[#566fe9]">{wordCount} words</span>
              </div>
            </div>
            
            {/* User and AI Images */}
            <div className="absolute top-[116px] right-[80px]">
              <div className="w-[200px] h-[200px] rounded-xl bg-gray-200 flex items-center justify-center overflow-hidden">
                <img 
                  src="/images/img_rectangle_63.png" 
                  alt="User" 
                  className="w-full h-full object-cover" 
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://ui-avatars.com/api/?name=User&background=566FE9&color=fff';
                  }}
                />
              </div>
              <div className="bg-white rounded-md px-2.5 py-1 mt-2 inline-block shadow-sm">
                <span className="text-sm font-semibold text-[#566fe9]">{userName || 'User'}</span>
              </div>
            </div>
            
            <div className="absolute top-[116px] right-[304px]">
              <div className="w-[200px] h-[200px] rounded-xl bg-gray-200 flex items-center justify-center overflow-hidden">
                <img 
                  src="/images/img_image_5.png" 
                  alt="AI Speaking Teacher" 
                  className="w-full h-full object-cover" 
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://ui-avatars.com/api/?name=AI+Teacher&background=566FE9&color=fff';
                  }}
                />
              </div>
              <div className="bg-white rounded-md px-2.5 py-1.5 mt-2 inline-block shadow-sm">
                <span className="text-sm font-semibold text-[#566fe9]">AI Speaking Teacher</span>
              </div>
            </div>
            
            {/* Timer Notification */}
            {showTimerNotification && (
              <div className="absolute top-[280px] left-[152px] p-3 bg-yellow-100 border border-yellow-300 rounded-md w-[800px]">
                <p className="text-yellow-800">Time's up! Please finish your answer and click "Complete" when you're done.</p>
              </div>
            )}
            
            {/* Bottom control bar */}
            <div className="absolute bottom-[32px] left-[152px] w-[800px] flex justify-between items-center">
              <div className="flex space-x-4">
                {/* Control buttons */}
                <div className="flex space-x-3">
                  {/* Mic button - controlled by LiveKit */}
                  <button className="w-12 h-12 rounded-md border border-[#566fe9] flex items-center justify-center hover:bg-blue-50 transition-colors">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {/* Camera button */}
                  <button className="w-12 h-12 rounded-md border border-[#566fe9] flex items-center justify-center hover:bg-blue-50 transition-colors">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M23 7l-7 5 7 5V7z" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {/* Refresh button - load new topic */}
                  <button 
                    onClick={loadNewTopic} 
                    className="w-12 h-12 rounded-md border border-[#566fe9] flex items-center justify-center hover:bg-blue-50 transition-colors"
                    title="Load new topic"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M23 4v6h-6" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M1 20v-6h6" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Complete button */}
              <button
                onClick={handleLeave}
                className="bg-[#566fe9] hover:bg-[#4a5fc8] text-white px-6 py-3 rounded-md transition-colors flex items-center space-x-2"
              >
                <span>Complete</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
