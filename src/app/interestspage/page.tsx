'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  fetchUserInterests, 
  addInterest, 
  deleteInterest, 
  Interest, 
  PronityApiError 
} from '@/api/pronityClient';

export default function InterestsPage() {
  const router = useRouter();
  const [interests, setInterests] = useState<Interest[]>([]);
  const [newInterestName, setNewInterestName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication status on component mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      // Not authenticated, redirect to login
      router.push('/loginpage');
    } else {
      setIsAuthenticated(true);
      loadInterests();
    }
  }, [router]);

  // Load user interests
  const loadInterests = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('You must be logged in to view interests');
      }
      const interestsData = await fetchUserInterests(token);
      setInterests(interestsData);
    } catch (error) {
      console.error('Error loading interests:', error);
      if (error instanceof PronityApiError && error.statusCode === 401) {
        // Token expired or invalid
        localStorage.removeItem('token');
        router.push('/loginpage');
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load interests. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle adding a new interest
  const handleAddInterest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInterestName.trim()) {
      setErrorMessage('Please enter an interest name');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('You must be logged in to add interests');
      }
      
      await addInterest(newInterestName, token);
      setNewInterestName('');
      setSuccessMessage('Interest added successfully!');
      loadInterests(); // Reload interests after adding
    } catch (error) {
      console.error('Error adding interest:', error);
      if (error instanceof PronityApiError && error.statusCode === 401) {
        // Token expired or invalid
        localStorage.removeItem('token');
        router.push('/loginpage');
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to add interest');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle deleting an interest
  const handleDeleteInterest = async (interestId: string) => {
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('You must be logged in to delete interests');
      }
      
      await deleteInterest(interestId, token);
      setSuccessMessage('Interest deleted successfully!');
      loadInterests(); // Reload interests after deleting
    } catch (error) {
      console.error('Error deleting interest:', error);
      if (error instanceof PronityApiError && error.statusCode === 401) {
        // Token expired or invalid
        localStorage.removeItem('token');
        router.push('/loginpage');
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to delete interest');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return <div className="flex justify-center items-center h-screen">Checking authentication...</div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <h1 className="text-3xl font-bold mb-6 text-center">Manage Interests</h1>
      
      {/* Error and success messages */}
      {errorMessage && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
          <p>{errorMessage}</p>
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4" role="alert">
          <p>{successMessage}</p>
        </div>
      )}
      
      {/* Add new interest form */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Add New Interest</h2>
        <form onSubmit={handleAddInterest} className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            value={newInterestName}
            onChange={(e) => setNewInterestName(e.target.value)}
            placeholder="Enter interest name"
            className="flex-grow border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 text-white py-2 px-6 rounded hover:bg-blue-700 transition-colors disabled:bg-blue-400"
          >
            {isLoading ? 'Adding...' : 'Add Interest'}
          </button>
        </form>
      </div>
      
      {/* List of interests */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Your Interests</h2>
        
        {isLoading && interests.length === 0 ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
            <p>Loading interests...</p>
          </div>
        ) : interests.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {interests.map((interest) => (
              <li key={interest.id} className="py-4 flex items-center justify-between">
                <span className="text-lg">{interest.name}</span>
                <div className="flex gap-4">
                  <button
                    onClick={() => router.push(`/topics/${interest.id}`)}
                    className="bg-green-600 text-white py-1 px-3 rounded hover:bg-green-700 transition-colors"
                  >
                    View Topics
                  </button>
                  <button
                    onClick={() => handleDeleteInterest(interest.id)}
                    disabled={isLoading}
                    className="bg-red-600 text-white py-1 px-3 rounded hover:bg-red-700 transition-colors disabled:bg-red-400"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No interests found. Add your first interest using the form above.</p>
          </div>
        )}
      </div>
      
      {/* Back to main page button */}
      <div className="mt-8 text-center">
        <button
          onClick={() => router.push('/roxpage')}
          className="bg-gray-600 text-white py-2 px-6 rounded hover:bg-gray-700 transition-colors"
        >
          Back to Main Page
        </button>
      </div>
    </div>
  );
}
