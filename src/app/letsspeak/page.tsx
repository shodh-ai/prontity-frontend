'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import NextTaskButton from '@/components/NextTaskButton';
import { MicIcon, RefreshCw } from 'lucide-react';

// Define the task data structure
interface TaskData {
  taskTitle: string;
  taskDescription: string;
  suggestedPoints: string[];
  difficultyLevel: number;
  topic: string;
  error?: string;
}

export default function LetsSpeakPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get flow navigation parameters from URL
  const flowPosition = parseInt(searchParams?.get('flowPosition') || '0', 10);
  const totalTasks = parseInt(searchParams?.get('totalTasks') || '0', 10);
  const taskId = searchParams?.get('taskId');
  const topicId = searchParams?.get('topicId');
  
  // State for the task
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskData, setTaskData] = useState<TaskData | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'completed'>('idle');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Extract topic from topicId
  const getTopic = () => {
    // If topicId is in format "topic-technology", extract "technology"
    if (topicId && topicId.startsWith('topic-')) {
      return topicId.substring(6);
    }
    
    // Default topics if none provided
    const defaultTopics = ['technology', 'education', 'environment', 'health', 'culture'];
    const randomIndex = Math.floor(Math.random() * defaultTopics.length);
    return defaultTopics[randomIndex];
  };
  
  // Generate a speaking task using our Python service
  const generateTask = async (topic: string) => {
    setGenerating(true);
    setError(null);
    
    try {
      // Call our task generation service
      const response = await fetch('http://localhost:5001/generate-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: topic,
          taskType: 'speaking'
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate task: ${response.statusText}`);
      }
      
      const data = await response.json();
      setTaskData(data);
      
    } catch (err: any) {
      console.error('Error generating task:', err);
      
      // Create a fallback task if the service is unavailable
      setTaskData({
        taskTitle: `Speaking about ${topic}`,
        taskDescription: `Talk about your experience or opinion regarding ${topic}. Provide specific examples to support your answer.`,
        suggestedPoints: ['Personal experience', 'Specific examples', 'Your opinion'],
        difficultyLevel: 3,
        topic: topic,
        error: err.message
      });
      
      setError(`Could not connect to task generation service: ${err.message}`);
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  };
  
  // Start recording - simulate for now
  const startRecording = () => {
    setRecordingStatus('recording');
    
    // Start timer
    const interval = setInterval(() => {
      setElapsedTime(prev => {
        // Auto-stop at 45 seconds
        if (prev >= 45) {
          stopRecording();
          return 45;
        }
        return prev + 1;
      });
    }, 1000);
    
    setTimerInterval(interval);
  };
  
  // Stop recording
  const stopRecording = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    setRecordingStatus('completed');
  };
  
  // Reset the page to try again
  const resetTask = () => {
    setRecordingStatus('idle');
    setElapsedTime(0);
    
    // Generate a new task with the same topic
    if (taskData) {
      generateTask(taskData.topic);
    } else {
      generateTask(getTopic());
    }
  };
  
  // Handle task completion
  const handleTaskComplete = () => {
    console.log('Speaking task completed');
    // Would save recording data here in a real implementation
  };
  
  // Load task when component mounts
  useEffect(() => {
    const topic = getTopic();
    console.log(`Generating speaking task for topic: ${topic}`);
    generateTask(topic);
    
    // Cleanup timer on unmount
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [topicId]);
  
  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="min-h-screen w-full bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Speaking Practice</h1>
          
          {/* Flow position indicator */}
          {flowPosition !== null && totalTasks > 0 && (
            <div className="text-sm text-gray-500 mb-4">
              Task {flowPosition + 1} of {totalTasks}
            </div>
          )}
          
          {loading || generating ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-gray-700">
                {generating ? 'Generating your speaking task...' : 'Loading...'}
              </p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              <p className="font-bold">Error</p>
              <p>{error}</p>
              <button 
                onClick={resetTask}
                className="mt-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
              >
                Try Again
              </button>
            </div>
          ) : taskData ? (
            <div className="space-y-6">
              {/* Task content */}
              <div className="bg-blue-50 p-6 rounded-lg">
                <h2 className="text-xl font-semibold text-blue-900 mb-3">
                  {taskData.taskTitle}
                </h2>
                <p className="text-blue-800 text-lg mb-4 whitespace-pre-line">
                  {taskData.taskDescription}
                </p>
                <div className="mt-4">
                  <h3 className="font-medium text-blue-900 mb-2">Suggested points to address:</h3>
                  <ul className="list-disc pl-5 text-blue-800">
                    {taskData.suggestedPoints.map((point, index) => (
                      <li key={index}>{point}</li>
                    ))}
                  </ul>
                </div>
                <div className="mt-4 text-sm text-blue-700">
                  Difficulty: {Array(taskData.difficultyLevel).fill('⭐').join('')}
                </div>
              </div>
              
              {/* Timer and recording controls */}
              <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
                <div className="text-2xl font-mono">
                  {formatTime(elapsedTime)}<span className="text-sm text-gray-500 ml-2">/00:45</span>
                </div>
                
                <div className="flex space-x-4">
                  {recordingStatus === 'idle' && (
                    <button
                      onClick={startRecording}
                      className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors"
                    >
                      <MicIcon className="h-5 w-5" />
                      <span>Start Recording</span>
                    </button>
                  )}
                  
                  {recordingStatus === 'recording' && (
                    <button
                      onClick={stopRecording}
                      className="flex items-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors animate-pulse"
                    >
                      <span>Stop Recording</span>
                    </button>
                  )}
                  
                  {recordingStatus === 'completed' && (
                    <button
                      onClick={resetTask}
                      className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
                    >
                      <RefreshCw className="h-5 w-5" />
                      <span>Try Again</span>
                    </button>
                  )}
                </div>
              </div>
              
              {/* Next task button - only show after completing */}
              {recordingStatus === 'completed' && (
                <div className="mt-6">
                  <NextTaskButton 
                    onBeforeNavigate={handleTaskComplete}
                    buttonText="Complete & Continue"
                    className="w-full py-3"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-700">No speaking task available.</p>
              <button 
                onClick={resetTask}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
              >
                Generate Task
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
