import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { navigateToNextTask } from '@/utils/flowNavigation';

interface NextTaskButtonProps {
  onBeforeNavigate?: () => Promise<void> | void;
  className?: string;
  buttonText?: string;
}

/**
 * Button component that navigates to the next task in the learning flow
 */
export default function NextTaskButton({ 
  onBeforeNavigate, 
  className = '', 
  buttonText = 'Continue to Next Task'
}: NextTaskButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleNextTask = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Optional callback to save progress or data before navigating
      if (onBeforeNavigate) {
        await onBeforeNavigate();
      }
      
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/loginpage');
        return;
      }
      
      await navigateToNextTask(router, token);
    } catch (error: any) {
      const errorMessage = error.message || 'Error navigating to next task';
      console.error(errorMessage, error);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <button
        onClick={handleNextTask}
        disabled={loading}
        className={`px-4 py-2 ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-md ${className}`}
      >
        {loading ? 'Loading...' : buttonText}
      </button>
      
      {error && (
        <div className="mt-2 text-red-600 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
