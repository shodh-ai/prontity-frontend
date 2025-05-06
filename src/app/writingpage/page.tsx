'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useSession } from 'next-auth/react';
import { XIcon } from 'lucide-react';

// Define type for writing prompts
interface WritingPrompt {
  promptId: string;
  title: string;
  promptText: string;
  difficultyLevel: number;
}

type WritingPromptsType = {
  [key: string]: WritingPrompt;
};

// Local dummy data
const writingPrompts: WritingPromptsType = {
  'prompt-narrative-story': {
    promptId: 'prompt-narrative-story',
    title: 'A Memorable Journey',
    promptText: 'Write a narrative essay about a memorable journey or trip you have taken. Include details about the destination, the people you were with, and why it was memorable.',
    difficultyLevel: 2,
  },
  'prompt-argumentative-1': {
    promptId: 'prompt-argumentative-1',
    title: 'Technology and Society',
    promptText: 'Do you believe technology has made us more connected or more isolated? Write an argumentative essay supporting your position with examples and evidence.',
    difficultyLevel: 3,
  },
  'prompt-descriptive': {
    promptId: 'prompt-descriptive',
    title: 'A Special Place',
    promptText: 'Describe a place that is special to you. It could be your hometown, a vacation spot, or any location that has meaning for you. Use descriptive language to help readers visualize this place.',
    difficultyLevel: 2,
  }
};

// Teacher comments for AI feedback
const teacherComments = [
  {
    text: "Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College.",
  },
  {
    text: "Try using more transition words like however, therefore, or in contrast to improve the flow between your ideas.",
  },
  {
    text: "Editing one extra time for grammar and punctuation will make your final piece look much more polished.",
  },
];

function WritingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [userName, setUserName] = useState('');
  const [essay, setEssay] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<WritingPrompt | null>(null);
  
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
  
  // Load a writing prompt from local dummy data
  useEffect(() => {
    const fetchWritingPrompt = () => {
      setLoading(true);
      setError(null);
      try {
        // Get prompt ID from URL query parameters if available
        const promptIdFromUrl = searchParams?.get('promptId');
        
        // Default prompt IDs from our local data
        const availablePromptIds = Object.keys(writingPrompts);
        
        // Use the prompt ID from URL or default to the first in our list
        const targetPromptId = promptIdFromUrl || availablePromptIds[0];
        
        // Get the writing prompt from local data
        const promptData = writingPrompts[targetPromptId];
        
        if (promptData) {
          setPrompt(promptData);
          console.log('Loaded prompt:', promptData.title, 'with ID:', targetPromptId);
        } else {
          // Handle case when prompt ID is not found
          setError(`Prompt ID "${targetPromptId}" not found in available prompts`);
        }
      } catch (err) {
        console.error('Error loading writing prompt:', err);
        setError('Failed to load writing prompt. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchWritingPrompt();
  }, [searchParams]);
  
  // Function to load a different writing prompt
  const loadNewPrompt = () => {
    // Available prompt IDs from the API documentation
    const availablePromptIds = ['prompt-narrative-story', 'prompt-argumentative-1', 'prompt-descriptive'];
    
    // Get a random prompt ID different from the current one
    const currentPromptId = prompt?.promptId;
    const availableIds = availablePromptIds.filter(id => id !== currentPromptId);
    const randomIndex = Math.floor(Math.random() * availableIds.length);
    const newPromptId = availableIds[randomIndex];
    
    // Navigate to the same page with a new prompt ID
    router.push(`/writingpage?promptId=${newPromptId}`);
  };
  
  // Handle leaving the room
  const handleLeave = () => {
    // Simulated progress recording (local only, no API call)
    try {
      const token = localStorage.getItem('token');
      if (token && prompt) {
        console.log('Would record task completion for prompt:', prompt.promptId, 'with words:', essay.split(/\s+/).filter(Boolean).length);
      }
    } catch (err) {
      console.error('Error recording task completion:', err);
    }
    
    router.push('/roxpage');
  };

  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center overflow-hidden relative">
      {/* Background decorative elements - exact positioning from project 6 */}
      <div className="absolute w-[753px] h-[753px] top-0 right-0 bg-[#566fe9] rounded-[376.5px] -z-10" />
      <div className="absolute w-[353px] h-[353px] bottom-0 left-0 bg-[#336de6] rounded-[176.5px] -z-10" />
      <div className="absolute inset-0 bg-[#ffffff99] backdrop-blur-[200px] -z-10" />

      {/* Main content card - exact styling from project 6 */}
      <div className="w-[1280px] h-[740px] bg-white rounded-xl border-none m-4 relative">
        <div className="p-6">
          {/* Close button */}
          <button 
            onClick={handleLeave}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <XIcon className="h-6 w-6" />
          </button>

          {/* Progress section */}
          <div className="flex justify-between items-center mb-8">
            <h1 className="font-['Plus_Jakarta_Sans',Helvetica] font-semibold text-black text-base">
              Writing Practice Session
            </h1>
            <div className="w-[610px]">
              <div className="h-2.5 bg-[#c7ccf8] bg-opacity-20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#566fe9] rounded-full" 
                  style={{ width: '28%' }}
                ></div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-[600px] w-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#566fe9] mx-auto"></div>
                <p className="mt-4 text-gray-700 font-medium">Loading writing prompt...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-[600px] w-full">
              <div className="text-center bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg max-w-md shadow-sm">
                <p className="font-bold text-lg mb-2">Error loading writing prompt</p>
                <p>{error}</p>
                <button 
                  onClick={loadNewPrompt} 
                  className="mt-4 bg-[#566fe9] hover:bg-[#4a5fc8] text-white px-5 py-2 rounded-md transition-colors duration-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : prompt ? (
            /* Main content grid - exact layout from project 6 */
            <div className="grid grid-cols-[2fr_1fr] gap-8">
              {/* Left column - Reading and Writing */}
              <div className="space-y-6">
                {/* Reading section */}
                <div>
                  <h3 className="opacity-60 font-semibold mb-3">Read the passage</h3>
                  <div className="font-normal text-base leading-[25.6px]">
                    <h2 className="text-xl font-semibold mb-2">{prompt.title}</h2>
                    <p>{prompt.promptText}</p>
                    <br />
                    <p>
                      Contrary to popular belief, Lorem Ipsum is not simply random
                      text. It has roots in a piece of classical Latin literature from
                      45 BC, making it over 2000 years old. Richard McClintock, a
                      Latin professor at Hampden-Sydney College in Virginia, looked up
                      one of the more obscure Latin words, consectetur, from a Lorem
                      Ipsum passage, and going through the cites of the word in
                      classical literature, discovered the undoubtable source.
                    </p>
                  </div>
                </div>

                {/* Writing section */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="opacity-60 font-semibold">User Answer</h3>
                    <span className="text-[#566fe9]">
                      Word Count: {essay.split(/\s+/).filter(Boolean).length}
                    </span>
                  </div>
                  <div className="border border-gray-100 rounded-md shadow-sm">
                    <textarea
                      className="w-full min-h-[300px] p-5 border-none rounded-md outline-none resize-none font-normal text-base leading-[25.6px]"
                      value={essay}
                      onChange={(e) => setEssay(e.target.value)}
                      placeholder="Start writing your essay here..."
                    />
                    {essay.length > 0 && (
                      <div className="relative">
                        <div className="absolute bg-[#ef0e27] opacity-10 bottom-0 left-5 right-5 h-[25px]" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right column - Comments */}
              <div>
                <h2 className="opacity-60 font-semibold mb-3">Comments</h2>
                <div className="h-[520px] pr-4 overflow-y-auto">
                  {teacherComments.map((comment, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-5 mb-4 rounded-xl bg-gray-50"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#566fe9] flex items-center justify-center text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <div className="space-y-2">
                        <div className="opacity-60 font-semibold">
                          AI Writing Teacher
                        </div>
                        <div className="font-normal text-base leading-[25.6px]">
                          {comment.text}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <button
                  onClick={handleLeave}
                  className="w-full mt-4 py-2 border border-[#566fe9] rounded-md text-[#566fe9]"
                >
                  Next Session
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[600px] w-full">
              <div className="text-center p-8 bg-white rounded-lg shadow-sm">
                <p className="text-lg text-gray-700 mb-4">No writing prompt available</p>
                <button 
                  onClick={loadNewPrompt} 
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

export default function WritingPage() {
  return (
    <ProtectedRoute>
      <WritingPageContent />
    </ProtectedRoute>
  );
}

                        <div className="opacity-80 font-semibold text-sm text-gray-700">
                          AI Writing Teacher
                        </div>
                        <div className="font-normal text-sm text-gray-600 leading-relaxed">
                          {comment.text}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Control Buttons */} 
              <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
                <button
                  onClick={loadNewPrompt}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-100 hover:border-[#566fe9] hover:text-[#566fe9] transition-colors text-sm"
                >
                  New Prompt
                </button>
                <button
                  onClick={handleLeave} // Or a submit function
                  className="px-4 py-2 bg-[#566fe9] hover:bg-[#4a5fc8] text-white rounded-md transition-colors duration-200 text-sm font-medium"
                >
                  Submit / Next
                </button>
              </div>

            </div>
          ) : (
            // Display when no prompt is loaded (after initial loading state)
            <div className="flex items-center justify-center h-[400px]">
              <div className="text-center p-8 bg-white rounded-lg">
                <p className="text-lg text-gray-700 mb-4">No writing prompt available</p>
                <button 
                  onClick={loadNewPrompt} 
                  className="mt-2 bg-[#566fe9] hover:bg-[#4a5fc8] text-white px-5 py-2 rounded-md transition-colors duration-200"
                >
                  Load Prompt
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WritingPage() {
  return (
    <ProtectedRoute>
      <WritingPageContent />
    </ProtectedRoute>
  );
}
