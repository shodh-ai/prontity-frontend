'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import contentApi from '@/api/contentService';
import userProgressApi from '@/api/userProgressService';

function RoxPageContent() {
  const router = useRouter();
  const { data: session } = useSession();
  const [userName, setUserName] = useState('');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userProgress, setUserProgress] = useState<any[]>([]);
  const [nextTask, setNextTask] = useState<any>(null);
  const [vocabWords, setVocabWords] = useState<any[]>([]);
  const [speakingTopics, setSpeakingTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
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
    
    // Fetch user data from services
    const fetchUserData = async () => {
      try {
        setLoading(true);
        // Get sample vocabulary words
        const vocabSamples = ['ubiquitous', 'ameliorate', 'ephemeral', 'serendipity'];
        const vocabPromises = vocabSamples.map(id => contentApi.getVocabWord(id));
        
        // Get sample speaking topics
        const topicSamples = ['topic-daily-routine', 'topic-climate-change', 'topic-technology'];
        const topicPromises = topicSamples.map(id => contentApi.getSpeakingTopic(id));
        
        // Fetch user profile and progress if token exists
        const token = localStorage.getItem('token');
        let profileData = null;
        let progressData = [];
        let nextTaskData = null;
        
        if (token) {
          try {
            profileData = await userProgressApi.getUserProfile();
            progressData = await userProgressApi.getUserProgress();
            nextTaskData = await userProgressApi.getNextTask();
          } catch (err) {
            console.error('Error fetching user data:', err);
            // Token might be invalid, but we'll continue with content data
          }
        }
        
        // Resolve all promises
        const [vocabResults, topicResults] = await Promise.all([
          Promise.allSettled(vocabPromises),
          Promise.allSettled(topicPromises)
        ]);
        
        // Extract successful results
        const validVocabWords = vocabResults
          .filter(result => result.status === 'fulfilled')
          .map(result => (result as PromiseFulfilledResult<any>).value);
          
        const validTopics = topicResults
          .filter(result => result.status === 'fulfilled')
          .map(result => (result as PromiseFulfilledResult<any>).value);
        
        setVocabWords(validVocabWords);
        setSpeakingTopics(validTopics);
        setUserProfile(profileData);
        setUserProgress(progressData);
        setNextTask(nextTaskData);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load content. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [session]);

  // Navigation to other practice sections with context
  const navigateToSpeaking = () => {
    // If we have a next task and it's a speaking task, pass the topic ID
    if (nextTask && nextTask.taskType === 'speaking') {
      router.push(`/speakingpage?topicId=${nextTask.contentRefId}`);
    } else if (speakingTopics.length > 0) {
      // Otherwise use the first available topic
      router.push(`/speakingpage?topicId=${speakingTopics[0].topicId}`);
    } else {
      router.push('/speakingpage');
    }
  };
  
  const navigateToWriting = () => {
    // If we have a next task and it's a writing task, pass the prompt ID
    if (nextTask && nextTask.taskType === 'writing') {
      router.push(`/writingpage?promptId=${nextTask.contentRefId}`);
    } else {
      router.push('/writingpage');
    }
  };
  
  const navigateToVocab = () => {
    // If we have a next task and it's a vocab task, pass the word ID
    if (nextTask && nextTask.taskType === 'vocab') {
      router.push(`/vocabpage?wordId=${nextTask.contentRefId}`);
    } else if (vocabWords.length > 0) {
      // Otherwise use the first available word
      router.push(`/vocabpage?wordId=${vocabWords[0].wordId}`);
    } else {
      router.push('/vocabpage');
    }
  };
  
  // Handle leaving the room
  const handleLeave = () => {
    router.push('/');
  };

  // Navigation items data
  const navItems = [
    { active: true, icon: "/dashboard.svg", alt: "Dashboard" },
    { active: false, icon: "/frame-1.svg", alt: "Frame 1" },
    { active: false, icon: "/frame.svg", alt: "Frame" },
    { active: false, icon: "/reference-material.svg", alt: "Reference Material" },
    { active: false, icon: "/frame-3.svg", alt: "Frame 3" },
  ];

  // Suggestion cards data - dynamically based on user progress
  const getSuggestionCards = () => {
    const defaultCards = [
      {
        title: "Summarize my learning",
        description: "so far, what have I covered and how well?",
        action: () => {}
      },
      {
        title: "Improve my speaking skills",
        description: "where am I lacking and how to fix it?",
        action: navigateToSpeaking
      },
      {
        title: "Start vocabulary practice",
        description: "enhance your English vocabulary",
        action: navigateToVocab
      },
    ];
    
    // If we have next task data, replace the first card with personalized suggestion
    if (nextTask) {
      let customCard = {
        title: "Continue your learning",
        description: "Your next task is ready",
        action: () => {}
      };
      
      if (nextTask.taskType === 'vocab') {
        customCard = {
          title: `Learn the word "${nextTask.contentRefId}"`,
          description: "Continue your vocabulary practice",
          action: navigateToVocab
        };
      } else if (nextTask.taskType === 'speaking') {
        customCard = {
          title: `Practice speaking about ${nextTask.contentRefId}`,
          description: "Continue your speaking practice",
          action: navigateToSpeaking
        };
      } else if (nextTask.taskType === 'writing') {
        customCard = {
          title: `Write about ${nextTask.contentRefId}`,
          description: "Continue your writing practice",
          action: navigateToWriting
        };
      }
      
      return [customCard, ...defaultCards.slice(1)];
    }
    
    return defaultCards;
  };
  
  const suggestionCards = getSuggestionCards();

  return (
    <div className="bg-white flex flex-row justify-center w-full">
      <div className="bg-white overflow-hidden w-[1440px] h-[820px]">
        <div className="relative w-[2012px] h-[1284px] top-[-359px] -left-36">
          {/* Background decorative elements */}
          <div className="absolute w-[753px] h-[753px] top-0 left-[1259px] bg-[#566fe9] rounded-[376.5px]" />
          <div className="absolute w-[353px] h-[353px] top-[931px] left-0 bg-[#336de6] rounded-[176.5px]" />
          <div className="absolute w-[1440px] h-[820px] top-[359px] left-36 bg-[#ffffff99] backdrop-blur-[200px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(200px)_brightness(100%)]" />

          {/* Sidebar navigation */}
          <div className="inline-flex flex-col h-[820px] items-center justify-between px-2 py-3.5 absolute top-[359px] left-36">
            {/* Logo */}
            <div className="flex w-[28.1px] h-7 items-start gap-[0.47px] px-[2.38px] py-0 relative">
              <Image
                className="relative w-[23.29px] h-7"
                alt="Final logo"
                src="/final-logo.png"
                width={24}
                height={28}
              />
            </div>

            {/* Navigation icons */}
            <div className="inline-flex flex-col items-start gap-3 relative flex-[0_0_auto]">
              {navItems.map((item, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="icon"
                  className={`inline-flex items-center gap-3 p-2 relative flex-[0_0_auto] rounded-md ${item.active ? "bg-[#566fe9]" : ""}`}
                >
                  <Image
                    className="relative w-6 h-6"
                    alt={item.alt}
                    src={item.icon}
                    width={24}
                    height={24}
                  />
                </Button>
              ))}
            </div>

            {/* Invisible spacer element */}
            <div className="flex w-[28.1px] h-7 items-start gap-[0.47px] px-[2.38px] py-0 relative opacity-0">
              <Image
                className="relative w-[23.29px] h-7"
                alt="Final logo"
                src="/final-logo-1.png"
                width={24}
                height={28}
              />
            </div>
          </div>

          {/* AI Assistant avatar */}
          <div className="absolute w-[250px] h-[250px] top-[519px] left-[767px] flex items-center justify-center">
            <Image
              className="object-cover"
              alt="AI Assistant"
              src="/image-3.png"
              width={250}
              height={250}
            />
          </div>

          {/* AI Assistant greeting with user progress */}
          <div className="absolute w-[700px] top-[792px] left-[542px] font-semibold text-black text-lg text-center leading-normal">
            {loading ? (
              "Loading your personalized content..."
            ) : error ? (
              error
            ) : (
              <>
                Hello {userName || 'there'}. I am Rox, your AI Assistant!
                {userProgress && userProgress.length > 0 && (
                  <div className="mt-2 text-sm font-normal">
                    You've completed {userProgress.length} learning tasks. {nextTask ? "Let's continue your journey!" : "Great job!"}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Suggestion cards */}
          <div className="inline-flex items-center gap-[11px] absolute top-[894px] left-[542px]" style={{width: '800px', left: '152px', transform: 'translateX(390px)'}}>
            {!loading && suggestionCards.map((card, index) => (
              <Card
                key={index}
                className="inline-flex flex-col items-start gap-2.5 pt-3 pb-4 px-4 relative flex-[0_0_auto] rounded-md border-[none] [background:linear-gradient(357deg,rgba(255,255,255,0)_0%,rgba(86,111,233,0.2)_100%)] cursor-pointer hover:shadow-md transition-shadow"
                onClick={card.action}
              >
                <CardContent className="inline-flex flex-col items-start gap-2 relative flex-[0_0_auto] p-0">
                  <div className="relative w-fit mt-[-1.00px] font-medium text-black text-base whitespace-nowrap">
                    {card.title}
                  </div>
                  <div className="relative w-[194px] font-normal text-black text-sm leading-normal">
                    {card.description}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Input area */}
          <div className="inline-flex items-center gap-3 absolute top-[830px] left-[542px]" style={{width: '800px', left: '152px', transform: 'translateX(390px)'}}>
            <div className="flex w-[592px] h-12 items-center justify-between pl-4 pr-2 py-5 relative rounded-md border border-solid border-[#566fe933]">
              <Input
                className="border-none shadow-none focus-visible:ring-0 opacity-40 font-normal text-black text-sm leading-normal whitespace-nowrap"
                placeholder="Ask me anything!"
              />
              <Button
                size="sm"
                className="inline-flex items-center gap-2.5 p-2 relative flex-[0_0_auto] mt-[-12.00px] mb-[-12.00px] bg-[#566fe9] rounded"
                onClick={() => {}}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M22 2L11 13"></path>
                  <path d="M22 2L15 22L11 13L2 9L22 2Z"></path>
                </svg>
              </Button>
            </div>

            <Button
              variant="outline"
              size="icon"
              className="inline-flex h-12 items-center gap-3.5 px-3.5 py-5 relative flex-[0_0_auto] rounded-md border border-solid border-[#566fe933]"
            >
              <Image
                className="relative w-5 h-5"
                alt="Frame"
                src="/frame-2.svg"
                width={20}
                height={20}
              />
              <Image
                className="relative w-px h-[29px] object-cover"
                alt="Line"
                src="/line-461.svg"
                width={1}
                height={29}
              />
              <Image
                className="relative w-5 h-5"
                alt="Frame"
                src="/frame-4.svg"
                width={20}
                height={20}
              />
            </Button>
          </div>
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
