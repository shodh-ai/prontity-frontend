'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import LiveKitSession from '@/components/LiveKitSession';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useSession } from 'next-auth/react';

// Define type for speaking topics
interface SpeakingTopic {
  topicId: string;
  title: string;
  promptText: string;
  difficultyLevel: number;
}

type SpeakingTopicsType = {
  [key: string]: SpeakingTopic;
};

// Local dummy data
const speakingTopics: SpeakingTopicsType = {
  'topic-daily-routine': {
    topicId: 'topic-daily-routine',
    title: 'Your Daily Routine',
    promptText: 'Describe your typical daily routine. What activities do you do regularly? How do you manage your time?',
    difficultyLevel: 1,
  },
  'topic-climate-change': {
    topicId: 'topic-climate-change',
    title: 'Climate Change',
    promptText: 'What are your thoughts on climate change? How does it affect your country? What can individuals do to help?',
    difficultyLevel: 3,
  },
  'topic-technology': {
    topicId: 'topic-technology',
    title: 'Technology in Education',
    promptText: 'How has technology changed education? Do you think these changes are mostly positive or negative?',
    difficultyLevel: 2,
  }
};

function SpeakingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [showTimerNotification, setShowTimerNotification] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [topic, setTopic] = useState<SpeakingTopic | null>(null);
  
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
  
  // Load a speaking topic from local dummy data
  useEffect(() => {
    const fetchSpeakingTopic = () => {
      setLoading(true);
      setError(null);
      try {
        // Get topic ID from URL query parameters if available
        const topicIdFromUrl = searchParams?.get('topicId');
        
        // Default topic IDs from our local data
        const availableTopicIds = Object.keys(speakingTopics);
        
        // Use the topic ID from URL or default to the first in our list
        const targetTopicId = topicIdFromUrl || availableTopicIds[0];
        
        // Get the speaking topic from local data
        const topicData = speakingTopics[targetTopicId];
        
        if (topicData) {
          setTopic(topicData);
          console.log('Loaded topic:', topicData.title, 'with ID:', targetTopicId);
        } else {
          // Handle case when topic ID is not found
          setError(`Topic ID "${targetTopicId}" not found in available topics`);
        }
      } catch (err) {
        console.error('Error loading speaking topic:', err);
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
    try {
      const token = localStorage.getItem('token');
      if (token && topic) {
        console.log('Would record task completion for topic:', topic.topicId);
      }
    } catch (err) {
      console.error('Error recording task completion:', err);
    }
    
    router.push('/roxpage');
  };
  
  // Handle timer end
  const handleTimerEnd = () => {
    setShowTimerNotification(true);
    setTimeout(() => {
      setShowTimerNotification(false);
    }, 3000);
  };

  return (
    <div className="w-[1440px] h-[820px] bg-white overflow-hidden mx-auto">
      <div className="relative w-[2012px] h-[1284px] top-[-359px] left-[-144px]">
        {/* Background elements - exact positioning from project 3 */}
        <div className="absolute w-[753px] h-[753px] top-0 left-[1259px] bg-[#566fe9] rounded-[376.5px]" />
        <div className="absolute w-[353px] h-[353px] top-[931px] left-0 bg-[#336de6] rounded-[176.5px]" />
        <div className="absolute w-[1440px] h-[820px] top-[359px] left-[144px] bg-[#ffffff99] backdrop-blur-[200px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(200px)_brightness(100%)]" />

        {/* Main card container - exact positioning from project 3 */}
        <div className="absolute w-[1280px] h-[740px] top-[399px] left-[224px] rounded-xl border-[none] bg-white">
          {/* Close button - exact positioning from project 3 */}
          <button 
            onClick={handleLeave}
            className="absolute w-6 h-6 top-[17px] left-[1207px] bg-[url(/close.svg)] bg-[100%_100%]"
            aria-label="Close"
          />
          
          {/* Progress bar - exact positioning from project 3 */}
          <div className="absolute w-[610px] h-2.5 top-[24px] left-[303px]">
            <div className="h-2.5 bg-[#c7ccf8] bg-opacity-20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#566fe9] rounded-full" 
                style={{ width: '28%' }}
              />
            </div>
          </div>

          {/* Session title - exact positioning from project 3 */}
          <div className="absolute top-[16px] left-[56px] font-['Plus_Jakarta_Sans',Helvetica] font-semibold text-black text-base tracking-[0] leading-6 whitespace-nowrap">
            Speaking Practice Session
          </div>
          
          {/* Think time section - exact positioning from project 3 */}
          <div className="absolute top-[116px] left-[56px] inline-flex flex-col gap-4">
            <div className="opacity-60 font-['Plus_Jakarta_Sans',Helvetica] font-semibold text-black text-base tracking-[0] leading-6 whitespace-nowrap">
              Think time
            </div>
            <div className="font-['Plus_Jakarta_Sans',Helvetica] font-normal text-black text-[32px] leading-10">
              01m : 00s
            </div>
            <button className="mt-4 px-6 py-3 bg-[#566fe9] text-white rounded-md">
              Record your answer
            </button>
          </div>
          
          {/* User and AI profile images - exact positioning from project 3 */}
          <div className="inline-flex items-start gap-6 absolute top-[116px] left-[787px] opacity-50">
            <div className="relative w-[200px] h-[200px] bg-[url(/rectangle-63.png)] bg-cover bg-[50%_50%]">
              <div className="inline-flex items-center justify-center gap-2.5 px-2.5 py-1 relative top-[163px] left-2 bg-white rounded-md">
                <div className="relative w-fit mt-[-1.00px] text-[#566fe9] whitespace-nowrap">
                  User
                </div>
              </div>
            </div>

            <div className="relative w-[200px] h-[200px] bg-[url(/image-5.png)] bg-cover bg-[50%_50%]">
              <div className="inline-flex items-center justify-center gap-2.5 px-2.5 py-1 relative top-[163px] left-2 bg-white rounded-md">
                <div className="relative w-fit mt-[-1.00px] text-[#566fe9] whitespace-nowrap">
                  AI Speaking Teacher
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="absolute top-[250px] left-[56px] w-[744px] flex items-center justify-center h-[355px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#566fe9] mx-auto"></div>
                <p className="mt-4 text-gray-700 font-medium">Loading speaking topic...</p>
              </div>
            </div>
          ) : error ? (
            <div className="absolute top-[250px] left-[56px] w-[744px] flex items-center justify-center h-[355px]">
              <div className="text-center bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg max-w-md shadow-sm">
                <p className="font-bold text-lg mb-2">Error loading speaking topic</p>
                <p>{error}</p>
                <button 
                  onClick={loadNewTopic} 
                  className="mt-4 bg-[#566fe9] hover:bg-[#4a5fc8] text-white px-5 py-2 rounded-md transition-colors duration-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : topic ? (
            <div className="absolute top-[250px] left-[56px] w-[744px] h-[355px]">
              {/* Topic section - exact positioning from project 3 */}
              <div className="opacity-60 font-['Plus_Jakarta_Sans',Helvetica] font-semibold text-black text-base tracking-[0] leading-6 whitespace-nowrap mb-3">
                Topic
              </div>
              
              <div className="mb-4">
                <div className="font-['Plus_Jakarta_Sans',Helvetica] font-semibold text-black text-xl leading-[30px] mb-1">
                  {topic.title}
                </div>
                <div className="font-['Plus_Jakarta_Sans',Helvetica] font-normal text-black text-base leading-[25.6px]">
                  {topic.promptText}
                </div>
              </div>
              
              {/* Question difficulty - exact positioning from project 3 */}
              <div className="mt-4 flex items-center">
                <span className="opacity-60 font-['Plus_Jakarta_Sans',Helvetica] font-semibold text-black text-sm mr-2">Difficulty:</span>
                <div className="flex">
                  {[...Array(3)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-3 h-3 rounded-full mx-1 ${i < (topic.difficultyLevel || 0) ? 'bg-[#566fe9]' : 'bg-[#c7ccf8] bg-opacity-20'}`}
                    />
                  ))}
                </div>
              </div>
              
              {/* User answer section - exact positioning from project 3 */}
              <div className="relative mt-10">
                <div className="flex w-[744px] items-center justify-between">
                  <div className="relative w-fit opacity-60 font-['Plus_Jakarta_Sans',Helvetica] font-semibold text-black text-base tracking-[0] leading-6 whitespace-nowrap">
                    User Answer
                  </div>
                  <div className="relative w-fit text-[#566fe9] whitespace-nowrap">
                    Word Count: 0
                  </div>
                </div>
                
                <div className="mt-3 w-[744px]">
                  {/* This will hold the LiveKitSession with modified styling */}
                  <div className="relative bg-white rounded-lg border border-[#eaeaea] p-4 min-h-[200px]">
                    <LiveKitSession
                      roomName={roomName}
                      userName={userName || 'student-user'}
                      questionText={topic.promptText}
                      sessionTitle={`Speaking Practice: ${topic.title}`}
                      onLeave={handleLeave}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="absolute top-[250px] left-[56px] w-[744px] flex items-center justify-center h-[355px]">
              <div className="text-center p-8 bg-white rounded-lg shadow-sm">
                <p className="text-lg text-gray-700 mb-4">No speaking topic available</p>
                <button 
                  onClick={loadNewTopic} 
                  className="mt-2 bg-[#566fe9] hover:bg-[#4a5fc8] text-white px-5 py-2 rounded-md transition-colors duration-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
          
          {/* Control buttons at the bottom - exact positioning from project 3 */}
          <div className="inline-flex items-center gap-2 absolute top-[668px] left-[500px] opacity-50">
            <button className="w-12 h-12 p-3 border border-[#566fe9] rounded-md flex items-center justify-center">
              <div className="w-6 h-6 bg-[url(/mic-on.svg)] bg-[100%_100%]" />
            </button>
            
            <button className="w-12 h-12 p-3 border border-[#566fe9] rounded-md flex items-center justify-center">
              <img className="w-6 h-6" alt="Pause" src="/frame.svg" />
            </button>
            
            <button onClick={loadNewTopic} className="w-12 h-12 p-3 border border-[#566fe9] rounded-md flex items-center justify-center">
              <img className="w-6 h-6" alt="Refresh" src="/frame-4.svg" />
            </button>
            
            <button className="w-12 h-12 p-3 border border-[#566fe9] rounded-md flex items-center justify-center">
              <img className="w-6 h-6" alt="Settings" src="/frame-3.svg" />
            </button>
          </div>
        </div>
      </div>
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
