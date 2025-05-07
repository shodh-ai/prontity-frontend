'use client';

import { XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import ProtectedRoute from '@/components/ProtectedRoute';
import { useSession } from 'next-auth/react';

// Define writing prompt types
interface WritingPrompt {
  promptId: string;
  title: string;
  promptText: string;
  keyPoints: string[];
  difficultyLevel: number;
}

// Sample writing prompts
const writingPrompts: Record<string, WritingPrompt> = {
  'prompt-technology-education': {
    promptId: 'prompt-technology-education',
    title: 'The impact of technology on modern education',
    promptText: 'Write an essay about the impact of technology on modern education. Consider both positive and negative effects, and discuss how educational institutions can adapt to technological changes.',
    keyPoints: [
      'The role of online learning platforms',
      'Impact on student engagement and participation',
      'Changes in teaching methodologies',
      'Digital literacy and its importance',
      'Challenges and opportunities in implementing technology'
    ],
    difficultyLevel: 3,
  },
  'prompt-climate-action': {
    promptId: 'prompt-climate-action',
    title: 'Climate change and individual responsibility',
    promptText: 'Discuss the role of individual actions in addressing climate change. To what extent can personal choices make a difference, and what systemic changes might be necessary?',
    keyPoints: [
      'Individual carbon footprint reduction strategies',
      'The impact of collective individual actions',
      'Corporate responsibility vs. personal responsibility',
      'Policy changes needed at governmental levels',
      'Balancing immediate convenience with long-term sustainability'
    ],
    difficultyLevel: 3,
  },
  'prompt-cultural-identity': {
    promptId: 'prompt-cultural-identity',
    title: 'Cultural identity in a globalized world',
    promptText: 'Explore how cultural identities are maintained, challenged, or transformed in an increasingly connected global society.',
    keyPoints: [
      'The influence of social media on cultural expression',
      'Preserving traditional practices in modern contexts',
      'The concept of hybrid cultural identities',
      'Language preservation and evolution',
      'Cultural appropriation versus cultural appreciation'
    ],
    difficultyLevel: 2,
  }
};

function WritingPromptContent() {
  const router = useRouter();
  const { data: session } = useSession();
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<WritingPrompt | null>(null);
  const [progress, setProgress] = useState(28); // Sample progress percentage

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
    
    // Load a random prompt
    loadRandomPrompt();
  }, [session]);

  // Load a random prompt from our collection
  const loadRandomPrompt = () => {
    setLoading(true);
    try {
      const promptIds = Object.keys(writingPrompts);
      const randomIndex = Math.floor(Math.random() * promptIds.length);
      const randomPromptId = promptIds[randomIndex];
      const selectedPrompt = writingPrompts[randomPromptId];
      
      if (selectedPrompt) {
        setCurrentPrompt(selectedPrompt);
        setError(null);
      } else {
        setError('No writing prompts available');
      }
    } catch (err) {
      console.error('Error loading prompt:', err);
      setError('Failed to load writing prompt');
    } finally {
      setLoading(false);
    }
  };

  // Handle skip action
  const handleSkip = () => {
    loadRandomPrompt();
  };

  // Handle start writing action
  const handleStartWriting = () => {
    // Redirect to a writing interface or open a modal
    if (currentPrompt) {
      router.push(`/writingpage?promptId=${currentPrompt.promptId}`);
    }
  };

  // Handle close/exit action
  const handleClose = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center overflow-hidden relative">
      {/* Background decorative elements */}
      <div className="absolute w-[753px] h-[753px] top-0 right-0 bg-[#566fe9] rounded-[376.5px] -z-10" />
      <div className="absolute w-[353px] h-[353px] bottom-0 left-0 bg-[#336de6] rounded-[176.5px] -z-10" />
      <div className="absolute inset-0 bg-[#ffffff99] backdrop-blur-[200px] -z-10" />

      {/* Main content card - positioned at x:152px with 800px width as per user preference */}
      <div 
        className="w-[800px] bg-white rounded-xl border-none shadow-lg m-4 relative"
        style={{ marginLeft: '152px' }}
      >
        <div className="p-6">
          {/* Close button */}
          <button 
            onClick={handleClose}
            className="absolute top-4 right-4 hover:bg-gray-100 rounded-full p-1 transition-colors"
          >
            <XIcon className="h-6 w-6" />
          </button>

          {/* Progress section */}
          <div className="flex justify-between items-center mb-8">
            <h1 className="font-semibold text-black text-base">
              Writing Practice Session
            </h1>
            <div className="w-[400px]">
              <div className="h-2 bg-[#c7ccf8] opacity-20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#566fe9]" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-[328px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#566fe9] mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading writing prompt...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-[328px]">
              <div className="text-center bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-lg max-w-md">
                <p className="font-bold mb-2">Error loading writing prompt</p>
                <p>{error}</p>
                <button 
                  onClick={loadRandomPrompt} 
                  className="mt-4 bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-md transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : currentPrompt ? (
            /* Main content with height 328px as per user preference */
            <div className="max-w-3xl mx-auto space-y-8 h-[328px] overflow-y-auto">
              <div className="space-y-6">
                <h2 className="text-3xl font-semibold text-center">
                  {currentPrompt.title}
                </h2>
                <p className="text-md text-center text-gray-600">
                  {currentPrompt.promptText}
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Key points to consider:</h3>
                <ul className="list-disc pl-6 space-y-1.5 text-gray-600">
                  {currentPrompt.keyPoints.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-center gap-4">
                <button
                  onClick={handleSkip}
                  className="px-6 py-2 border border-[#566fe9] text-[#566fe9] rounded-md hover:bg-blue-50 transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={handleStartWriting}
                  className="px-6 py-2 bg-[#566fe9] text-white rounded-md hover:bg-[#4559ba] transition-colors"
                >
                  Start Writing
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[328px]">
              <div className="text-center">
                <p className="text-lg text-gray-600 mb-4">No writing prompts available</p>
                <button 
                  onClick={loadRandomPrompt} 
                  className="px-6 py-2 bg-[#566fe9] hover:bg-[#4559ba] text-white rounded-md transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WritingPromptPage() {
  return (
    <ProtectedRoute>
      <WritingPromptContent />
    </ProtectedRoute>
  );
}
