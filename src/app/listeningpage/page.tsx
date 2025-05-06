'use client';

import { MicIcon, PlayIcon, XIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useSession } from 'next-auth/react';

// Define type for listening questions
interface ListeningQuestion {
  questionId: string;
  title: string;
  audioUrl: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
}

type ListeningQuestionsType = {
  [key: string]: ListeningQuestion;
};

// Local dummy data
const listeningQuestions: ListeningQuestionsType = {
  'question-staff-meeting': {
    questionId: 'question-staff-meeting',
    title: 'Staff Meeting',
    audioUrl: '/audio/staff-meeting.mp3',
    questionText: 'What topic are the two staff members talking about?',
    options: [
      'Who to hire for the specific job.',
      'What to do at the upcoming faculty party.',
      'Who to fire.',
      'How to evaluate new teachers.',
    ],
    correctAnswer: 0,
  },
  'question-weather-forecast': {
    questionId: 'question-weather-forecast',
    title: 'Weather Forecast',
    audioUrl: '/audio/weather-forecast.mp3',
    questionText: 'What will the weather be like tomorrow according to the forecast?',
    options: [
      'Sunny and warm.',
      'Rainy with thunderstorms.',
      'Cloudy with a chance of rain.',
      'Cold and windy.',
    ],
    correctAnswer: 2,
  },
  'question-train-announcement': {
    questionId: 'question-train-announcement',
    title: 'Train Announcement',
    audioUrl: '/audio/train-announcement.mp3',
    questionText: 'Why is the train delayed?',
    options: [
      'Due to technical issues.',
      'Because of bad weather conditions.',
      'There was an accident on the tracks.',
      'The conductor is running late.',
    ],
    correctAnswer: 1,
  },
};

function ListeningPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState<ListeningQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Get username from session or localStorage when component mounts
  useEffect(() => {
    if (session?.user?.name) {
      setUserName(session.user.name);
    } else {
      const storedUserName = localStorage.getItem('userName');
      if (storedUserName) {
        setUserName(storedUserName);
      } else {
        // Redirect to login if no username found
        router.push('/loginpage');
      }
    }
  }, [router, session]);
  
  // Load a listening question from local dummy data
  useEffect(() => {
    const fetchListeningQuestion = () => {
      setLoading(true);
      setError(null);
      try {
        // Get question ID from URL query parameters if available
        const questionIdFromUrl = searchParams?.get('questionId');
        
        // Default question IDs from our local data
        const availableQuestionIds = Object.keys(listeningQuestions);
        
        // Use the question ID from URL or default to the first in our list
        const targetQuestionId = questionIdFromUrl || availableQuestionIds[0];
        
        // Get the listening question from local data
        const questionData = listeningQuestions[targetQuestionId];
        
        if (questionData) {
          setQuestion(questionData);
          console.log('Loaded question:', questionData.title, 'with ID:', targetQuestionId);
        } else {
          // Handle case when question ID is not found
          setError(`Question ID "${targetQuestionId}" not found in available questions`);
        }
      } catch (err) {
        console.error('Error loading listening question:', err);
        setError('Failed to load listening question. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchListeningQuestion();
  }, [searchParams]);
  
  // Function to load a different listening question
  const loadNewQuestion = () => {
    // Available question IDs from the local data
    const availableQuestionIds = Object.keys(listeningQuestions);
    
    // Get a random question ID different from the current one
    const currentQuestionId = question?.questionId;
    const availableIds = availableQuestionIds.filter(id => id !== currentQuestionId);
    const randomIndex = Math.floor(Math.random() * availableIds.length);
    const newQuestionId = availableIds[randomIndex];
    
    // Navigate to the same page with a new question ID
    router.push(`/listeningpage?questionId=${newQuestionId}`);
  };
  
  // Handle leaving the page
  const handleLeave = () => {
    // Simulated progress recording (local only, no API call)
    try {
      const token = localStorage.getItem('token');
      if (token && question) {
        console.log('Would record task completion for question:', question.questionId);
      }
    } catch (err) {
      console.error('Error recording task completion:', err);
    }
    
    router.push('/roxpage');
  };
  
  // Toggle audio playback
  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
    // In a real app, this would control the audio element
    
    // Simulate progress for demo purposes
    if (!isPlaying) {
      const interval = setInterval(() => {
        setAudioProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsPlaying(false);
            return 100;
          }
          return prev + 5;
        });
      }, 500);
    }
  };
  
  // Handle option selection
  const handleOptionSelect = (index: number) => {
    setSelectedOption(index);
  };

  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center overflow-hidden relative">
      {/* Background decorative elements */}
      <div className="absolute w-[753px] h-[753px] top-0 right-0 bg-[#566fe9] rounded-[376.5px] -z-10" />
      <div className="absolute w-[353px] h-[353px] bottom-0 left-0 bg-[#336de6] rounded-[176.5px] -z-10" />
      <div className="absolute inset-0 bg-[#ffffff99] backdrop-blur-[200px] -z-10" />

      {/* Main content card - width: 800px, x: 152px as per user preference */}
      <div className="w-[1280px] h-[740px] bg-white rounded-xl border-none m-4 relative">
        <div className="p-8 h-full">
          {/* Close button */}
          <button 
            onClick={handleLeave}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <XIcon className="h-6 w-6" />
          </button>

          {loading ? (
            <div className="flex items-center justify-center h-[600px] w-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#566fe9] mx-auto"></div>
                <p className="mt-4 text-gray-700 font-medium">Loading listening exercise...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-[600px] w-full">
              <div className="text-center bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg max-w-md shadow-sm">
                <p className="font-bold text-lg mb-2">Error loading listening exercise</p>
                <p>{error}</p>
                <button 
                  onClick={loadNewQuestion} 
                  className="mt-4 bg-[#566fe9] hover:bg-[#4a5fc8] text-white px-5 py-2 rounded-md transition-colors duration-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : question ? (
            <>
              {/* User profiles section - right side */}
              <div className="absolute right-12 top-1/2 -translate-y-1/2 flex flex-col gap-6">
                <div className="relative w-[200px] h-[200px] bg-gray-200 rounded-md overflow-hidden">
                  <img 
                    src="/user-profile.png" 
                    alt="User" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // If image fails to load, show a fallback
                      e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23E2E8F0"/><path d="M100,80 C111,80 120,71 120,60 C120,49 111,40 100,40 C89,40 80,49 80,60 C80,71 89,80 100,80 Z M100,90 C83.33,90 50,98.33 50,115 L50,130 L150,130 L150,115 C150,98.33 116.67,90 100,90 Z" fill="%23A0AEC0"/></svg>'
                    }}
                  />
                  <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-white rounded-md">
                    <span className="text-[#566fe9] font-semibold text-sm">User</span>
                  </div>
                </div>

                <div className="relative w-[200px] h-[200px] bg-gray-200 rounded-md overflow-hidden">
                  <img 
                    src="/ai-teacher.png" 
                    alt="AI Teacher" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // If image fails to load, show a fallback
                      e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23EBF8FF"/><path d="M100,40 L60,65 L60,115 L100,140 L140,115 L140,65 L100,40 Z" fill="%2363B3ED"/><circle cx="100" cy="90" r="20" fill="%23FFFFFF"/></svg>'
                    }}
                  />
                  <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-white rounded-md">
                    <span className="text-[#566fe9] font-semibold text-sm">AI Listening Teacher</span>
                  </div>
                </div>
              </div>

              <div className="max-w-[800px] space-y-8 absolute left-[56px] top-[80px]">
                {/* Session title and progress */}
                <div className="space-y-4">
                  <h2 className="font-['Plus_Jakarta_Sans',Helvetica] font-semibold text-base">Listening Practice Session</h2>
                  <div className="w-[610px]">
                    <div className="h-2.5 bg-[#c7ccf8] bg-opacity-20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#566fe9] rounded-full" 
                        style={{ width: '28%' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Listen to lecture section */}
                <section className="space-y-3">
                  <h3 className="opacity-60 font-semibold text-base">Listen to the lecture</h3>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={togglePlayback}
                      className={`w-12 h-12 rounded-md flex items-center justify-center ${isPlaying ? 'bg-gray-200' : 'bg-[#566fe9]'}`}
                    >
                      <PlayIcon className="w-6 h-6 text-white" />
                    </button>
                    <button className="p-3 border border-[#566fe9] rounded-md flex items-center justify-center">
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 8V16M9 8V16" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <div className="relative w-[680px] h-[15px]">
                      <div className="relative h-[15px]">
                        <div 
                          className="absolute w-[680px] h-[5px] top-[5px] left-0 bg-[#566fe933] rounded-md"
                        />
                        <div 
                          className="absolute h-[5px] top-[5px] left-0 bg-[#566fe9] rounded-md opacity-90"
                          style={{ width: `${audioProgress * 6.8}px` }}
                        />
                        <div 
                          className="absolute w-[15px] h-[15px] top-0 bg-[#647aeb] rounded-[7.5px]"
                          style={{ left: `${audioProgress * 6.8 - 7.5}px` }}
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Questions section */}
                <section className="space-y-3">
                  <h3 className="opacity-60 font-semibold text-base">Answer the following questions</h3>
                  <p className="text-base leading-[25.6px]">
                    {question.questionText}
                  </p>
                </section>

                {/* Multiple choice options */}
                <div className="space-y-2">
                  {question.options.map((option, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-5 rounded-md border ${
                        selectedOption === index ? 'border-[#566fe9] bg-blue-50' : 'border-gray-200'
                      } cursor-pointer transition-colors duration-200`}
                      onClick={() => handleOptionSelect(index)}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        selectedOption === index ? 'border-[#566fe9]' : 'border-gray-300'
                      }`}>
                        {selectedOption === index && (
                          <div className="w-3 h-3 rounded-full bg-[#566fe9]" />
                        )}
                      </div>
                      <label
                        className="text-base leading-[25.6px] cursor-pointer"
                      >
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Control buttons - Centered at the bottom */}
              <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-2">
                <button className="w-12 h-12 border border-[#566fe9] rounded-md flex items-center justify-center">
                  <MicIcon className="w-6 h-6 text-[#566fe9]" />
                </button>
                <button onClick={loadNewQuestion} className="w-12 h-12 border border-[#566fe9] rounded-md flex items-center justify-center">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 12C2 6.48 6.48 2 12 2C17.52 2 22 6.48 22 12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12ZM12 6V12L16 14" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button className="w-12 h-12 border border-[#566fe9] rounded-md flex items-center justify-center">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7.5 12L10.5 9M10.5 9L13.5 12M10.5 9V15M16.5 12C16.5 15.18 13.93 18 10.5 18C7.07 18 4.5 15.18 4.5 12C4.5 8.82 7.07 6 10.5 6C13.93 6 16.5 8.82 16.5 12Z" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button className="w-12 h-12 border border-[#566fe9] rounded-md flex items-center justify-center">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[600px] w-full">
              <div className="text-center p-8 bg-white rounded-lg shadow-sm">
                <p className="text-lg text-gray-700 mb-4">No listening question available</p>
                <button 
                  onClick={loadNewQuestion} 
                  className="mt-2 bg-[#566fe9] hover:bg-[#4a5fc8] text-white px-5 py-2 rounded-md transition-colors duration-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ListeningPage() {
  return (
    <ProtectedRoute>
      <ListeningPageContent />
    </ProtectedRoute>
  );
}
