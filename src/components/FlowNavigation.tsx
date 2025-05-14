'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { nextFlowTask, FlowTask } from '@/api/pronityClient';

interface FlowNavigationProps {
  onCompleteTask?: () => void;
}

export default function FlowNavigation({ onCompleteTask }: FlowNavigationProps) {
  const router = useRouter();
  const [currentTask, setCurrentTask] = useState<FlowTask | null>(null);
  const [position, setPosition] = useState<number>(0);
  const [totalTasks, setTotalTasks] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load flow task information from localStorage on component mount
  useEffect(() => {
    try {
      const taskData = localStorage.getItem('currentFlowTask');
      const positionData = localStorage.getItem('currentFlowPosition');
      const totalData = localStorage.getItem('totalFlowTasks');
      
      if (taskData) {
        setCurrentTask(JSON.parse(taskData));
      }
      
      if (positionData) {
        setPosition(parseInt(positionData, 10));
      }
      
      if (totalData) {
        setTotalTasks(parseInt(totalData, 10));
      }
    } catch (err) {
      console.error('Error loading flow data from localStorage:', err);
    }
  }, []);

  const handleNextTask = async () => {
    // Call onCompleteTask callback if provided
    if (onCompleteTask) {
      onCompleteTask();
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError('You must be logged in to continue your learning flow');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('Calling nextFlowTask with token:', token.substring(0, 10) + '...');
      
      // Get next task from the backend
      const response = await nextFlowTask(token);
      console.log('Successfully received next task:', response);
      
      // Save new task data to localStorage
      localStorage.setItem('currentFlowTask', JSON.stringify(response.currentTask));
      localStorage.setItem('currentFlowPosition', String(response.currentPosition));
      localStorage.setItem('totalFlowTasks', String(response.totalTasks));
      
      // Navigate to the appropriate page based on task type
      navigateToTaskPage(response.currentTask.taskType);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to move to next task';
      setError(`${errorMessage}. Please try again later.`);
      console.error('Error moving to next task:', err);
      
      if (err.statusCode === 401) {
        // Token might be invalid - redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/loginpage');
      }
    } finally {
      setLoading(false);
    }
  };

  // Navigate to the appropriate page based on task type
  const navigateToTaskPage = (taskType: string) => {
    switch (taskType) {
      case 'reading':
        router.push('/listeningpage');
        break;
      case 'writing':
        router.push('/writingpage_tiptap');
        break;
      case 'speaking':
        router.push('/speakingpage');
        break;
      case 'vocab':
        router.push('/vocabpage');
        break;
      default:
        console.error('Unknown task type:', taskType);
        router.push('/');
    }
  };

  if (!currentTask) {
    return null; // No task data available
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold">Your Learning Flow</h3>
        <div className="text-sm text-gray-500">
          Task {position + 1} of {totalTasks}
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="mb-3">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full" 
            style={{ width: `${((position + 1) / totalTasks) * 100}%` }}
          ></div>
        </div>
      </div>
      
      {/* Task info */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2 mb-2">
          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
            {currentTask.taskType.charAt(0).toUpperCase() + currentTask.taskType.slice(1)}
          </span>
          <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded">
            Level {currentTask.difficultyLevel}
          </span>
          <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
            {currentTask.topic.name}
          </span>
        </div>
        <p className="text-sm text-gray-700">{currentTask.description}</p>
      </div>
      
      {/* Navigation button */}
      <div className="flex justify-end">
        <button
          onClick={handleNextTask}
          disabled={loading}
          className={`px-4 py-2 ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-md flex items-center`}
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading
            </>
          ) : (
            <>
              Complete & Continue
              <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </>
          )}
        </button>
      </div>
      
      {error && (
        <div className="mt-3 p-2 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
