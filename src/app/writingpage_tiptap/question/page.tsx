'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

interface Question {
  id: string;
  topicName: string;
  question: string;
  level: string;
}

export default function QuestionPage() {
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Function to fetch a question from the pronity-backend
    const fetchQuestion = async () => {
      try {
        setLoading(true);
        // Get topics from the backend
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/topic/all`);
        
        if (response.data && response.data.data && response.data.data.length > 0) {
          // For now, just select the first topic and create a question from it
          // In a real implementation, you might want to have actual questions in the database
          const topic = response.data.data[0];
          
          // Create a sample question based on the topic
          const questionData: Question = {
            id: topic.id || '1',
            topicName: topic.topicName,
            question: `Write an essay about "${topic.topicName}". Consider the implications and importance of this topic in today's world.`,
            level: topic.level || 'Intermediate'
          };
          
          setQuestion(questionData);
        } else {
          setError('No topics found. Please add some topics to get questions.');
        }
      } catch (err) {
        console.error('Error fetching question:', err);
        setError('Failed to load question. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchQuestion();
  }, []);

  const handleStartWriting = () => {
    // Navigate to the writing page, passing the question as state
    // In Next.js, we can use query params or localStorage to pass data between pages
    if (question) {
      // Store the question in localStorage for the writing page to access
      localStorage.setItem('writingQuestion', JSON.stringify(question));
      router.push('/writingpage_tiptap');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-center">Writing Task</h1>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <span className="block sm:inline">{error}</span>
        </div>
      ) : question ? (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <div className="mb-4">
            <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
              {question.level}
            </span>
            <span className="inline-block bg-gray-100 text-gray-800 text-xs font-semibold px-2.5 py-0.5 rounded ml-2">
              Topic: {question.topicName}
            </span>
          </div>
          
          <h2 className="text-xl font-semibold mb-4">Question:</h2>
          <p className="text-gray-700 mb-6 text-lg leading-relaxed">
            {question.question}
          </p>
          
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Take some time to think about the question before you start writing. Plan your response and consider different perspectives.
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center">
            <button
              onClick={handleStartWriting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105"
            >
              Start Writing
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-gray-100 p-4 rounded-lg text-center">
          No question available at the moment.
        </div>
      )}
      
      <div className="mt-8 bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-medium mb-2">Instructions:</h3>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>Read the question carefully before you begin writing.</li>
          <li>You will have access to AI suggestions as you write.</li>
          <li>Aim for a well-structured essay with introduction, body paragraphs, and conclusion.</li>
          <li>Take note of your word count - aim for 250-300 words.</li>
        </ul>
      </div>
    </div>
  );
}
