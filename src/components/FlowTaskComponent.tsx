import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchFlowTask, nextFlowTask, FlowResponse, FlowTask, fetchUserProfile, User } from '@/api/pronityClient';

interface FlowTaskComponentProps {
  onTaskComplete?: (taskType: string) => void;
}

export default function FlowTaskComponent({ onTaskComplete }: FlowTaskComponentProps) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [flowData, setFlowData] = useState<FlowResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get token from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      // Get user data
      fetchUserProfile(storedToken)
        .then(userData => {
          setUser(userData);
        })
        .catch(err => {
          console.error('Error fetching user profile:', err);
          // If token is invalid, clear it
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
        });
    }
  }, []);

  useEffect(() => {
    if (token) {
      loadFlowTask();
    }
  }, [token]);

  const loadFlowTask = async () => {
    if (!token) {
      setError('You must be logged in to view your learning flow');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetchFlowTask(token);
      setFlowData(response);
    } catch (err: any) {
      setError(err.message || 'Failed to load task flow. Please try again later.');
      console.error('Error loading flow task:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNextTask = async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);
      
      // Notify parent component about task completion if callback is provided
      if (onTaskComplete && flowData) {
        onTaskComplete(flowData.currentTask.taskType);
      }
      
      const response = await nextFlowTask(token);
      setFlowData(response);
      
      // Navigate to the appropriate page based on task type
      navigateToTaskPage(response.currentTask.taskType);
    } catch (err: any) {
      setError(err.message || 'Failed to move to next task. Please try again later.');
      console.error('Error moving to next task:', err);
    } finally {
      setLoading(false);
    }
  };

  // Navigate to the appropriate page based on task type
  const navigateToTaskPage = (taskType: string) => {
    // Save current task data to localStorage for the target page to use
    if (flowData) {
      localStorage.setItem('currentFlowTask', JSON.stringify(flowData.currentTask));
      localStorage.setItem('currentFlowPosition', String(flowData.currentPosition));
      localStorage.setItem('totalFlowTasks', String(flowData.totalTasks));
    }
    
    // Navigate to the corresponding page based on task type
    switch (taskType) {
      case 'reading':
        router.push('/listeningpage'); // Assuming this is your reading/listening page
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
        // Default to home page or show error
        console.error('Unknown task type:', taskType);
        router.push('/');
    }
  };
  
  // This component will now primarily handle loading flow data and navigation
  // We don't need to render actual task content anymore

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4 my-4">
        <p className="text-red-600">{error}</p>
        <button 
          onClick={loadFlowTask}
          className="mt-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-md"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!flowData) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 my-4">
        <p className="text-yellow-600">No flow data available. Please make sure the Pronity backend is running.</p>
        <button 
          onClick={loadFlowTask}
          className="mt-2 px-4 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-md"
        >
          Load Tasks
        </button>
      </div>
    );
  }
  
  // Auto-navigate to task page on initial load
  useEffect(() => {
    if (flowData && !loading) {
      navigateToTaskPage(flowData.currentTask.taskType);
    }
  }, [flowData]);

  // This component now just shows a loading state until navigation occurs
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold">Your Learning Journey</h2>
        <div className="text-sm text-gray-500">
          Task {flowData.currentPosition + 1} of {flowData.totalTasks}
        </div>
      </div>

      <div className="mb-4">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full" 
            style={{ width: `${((flowData.currentPosition + 1) / flowData.totalTasks) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="flex justify-center items-center h-40">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your next task...</p>
        </div>
      </div>
    </div>
  );
}

// We no longer need the task-specific content components as we'll navigate to dedicated pages
