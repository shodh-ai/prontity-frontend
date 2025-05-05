'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import LiveKitSession from '@/components/LiveKitSession';
import SpeakingTimer from '@/components/SpeakingTimer';

export default function Page() {
  const router = useRouter();
  const [showTimerNotification, setShowTimerNotification] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState<{
    id: number;
    text: string;
    answer?: {
      text: string;
      highlights: Array<{ text: string; start: number; end: number }>;
    }
  } | null>(null);
  const [questionId, setQuestionId] = useState<number | null>(null);
  
  // Room configuration
  const roomName = 'Speakingpage';
  const userName = 'quickstart-user';
  
  // Load a question from the database
  useEffect(() => {
    const fetchQuestion = async () => {
      setLoading(true);
      setError(null);
      try {
        // If questionId is set, fetch that specific question, otherwise get all and pick a random one
        if (questionId) {
          const response = await fetch('/api/questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: questionId })
          });
          
          if (!response.ok) throw new Error('Failed to fetch question');
          const data = await response.json();
          setQuestion(data);
        } else {
          // Get all questions and select a random one
          const response = await fetch('/api/questions');
          if (!response.ok) throw new Error('Failed to fetch questions');
          const data = await response.json();
          
          if (data.length > 0) {
            const randomIndex = Math.floor(Math.random() * data.length);
            setQuestion(data[randomIndex]);
            setQuestionId(data[randomIndex].id);
          } else {
            throw new Error('No questions available');
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        console.error('Error fetching question:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuestion();
  }, [questionId]);
  
  // Function to load a different question
  const loadNewQuestion = () => {
    setQuestionId(null); // This will trigger the useEffect to get a random question
  };
  
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
      
      {/* Question refresh button */}
      <button 
        onClick={loadNewQuestion}
        className="fixed top-4 right-4 z-50 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md shadow-lg transition-colors duration-200"
      >
        New Question
      </button>
      
      {loading ? (
        <div className="flex items-center justify-center h-screen w-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4">Loading question...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-screen w-full">
          <div className="text-center bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md">
            <p className="font-bold">Error loading question</p>
            <p>{error}</p>
            <button 
              onClick={loadNewQuestion} 
              className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
            >
              Try Again
            </button>
          </div>
        </div>
      ) : question ? (
        <LiveKitSession
          roomName={roomName}
          userName={userName}
          questionText={question.text}
          sessionTitle="Speaking Practice Session"
          onLeave={handleLeave}
        />
      ) : (
        <div className="flex items-center justify-center h-screen w-full">
          <div className="text-center">
            <p>No question available</p>
            <button 
              onClick={loadNewQuestion} 
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
