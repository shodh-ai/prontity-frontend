'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCanvasStore } from '@/state/canvasStore';
import VocabBox, { VocabularyItem } from '@/components/vocabulary/VocabBox';
import Image from 'next/image';
import LiveKitSession from '@/components/LiveKitSession';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useSession } from 'next-auth/react';
// Image handler is now imported from ClientImageHandler

// Import CSS 
import styles from './vocabnewpage.module.css';

// Vocabulary components
import TextInput from '@/components/vocabulary/TextInput';
import VocabAgentActionHandler from '@/components/vocabulary/VocabAgentActionHandler';
import BrowserOnly from '../../components/BrowserOnly';
import ClientImageHandler from '../../components/vocabulary/ClientImageHandler';

// Local dummy data
const vocabData = {
  'ubiquitous': {
    wordId: 'ubiquitous',
    wordText: 'Ubiquitous',
    definition: 'Present, appearing, or found everywhere.',
    exampleSentence: 'Mobile phones have become ubiquitous in modern society.',
    difficultyLevel: 3,
  },
  'ameliorate': {
    wordId: 'ameliorate',
    wordText: 'Ameliorate',
    definition: 'To make something bad or unsatisfactory better.',
    exampleSentence: 'The new policies were designed to ameliorate the living conditions in urban areas.',
    difficultyLevel: 4,
  },
  'ephemeral': {
    wordId: 'ephemeral',
    wordText: 'Ephemeral',
    definition: 'Lasting for a very short time.',
    exampleSentence: 'The beauty of cherry blossoms is ephemeral, lasting only a few days each year.',
    difficultyLevel: 3,
  },
  'serendipity': {
    wordId: 'serendipity',
    wordText: 'Serendipity',
    definition: 'The occurrence and development of events by chance in a happy or beneficial way.',
    exampleSentence: 'Finding this rare book was pure serendipity - I wasn\'t even looking for it!',
    difficultyLevel: 4,
  }
};

// Default vocabulary word to show while loading
const defaultVocabWord: VocabularyItem = {
  id: 'default',
  word: 'Loading...',
  partOfSpeech: '',
  definition: 'Loading vocabulary word...',
  exampleSentence: ''
};

// Interactive Vocabulary Image Gallery component
// Displays AI-generated images inline (not as popup)
function VocabImageGallery({ 
  vocabularyWord, 
  onGenerateImage 
}: { 
  vocabularyWord: string,
  onGenerateImage: (prompt: string) => void
}) {
  // State for storing generated images
  const [images, setImages] = useState<{ id: string; url: string; word: string; }[]>([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [loadingText, setLoadingText] = useState('Generating image...');
  const [prompt, setPrompt] = useState('');
  
  // Function to handle images received from the agent via our new direct system
  const handleAgentImageReceived = useCallback((imageData: { word: string, url: string, id: string }) => {
    console.log(`Received agent-generated image for ${imageData.word}`);
    setImages(prevImages => {
      // Avoid duplicates by checking if we already have this image
      const exists = prevImages.some(img => img.url === imageData.url || 
                                     (img.word === imageData.word && img.id.includes('agent')));
      if (exists) return prevImages;
      return [...prevImages, imageData];
    });
  }, []);

  // Subscribe to custom events for receiving images
  useEffect(() => {
    // Handle vocab image event
    const handleVocabImageEvent = (event: any) => {
      const vocab = event.detail;
      console.log("vocab image event", vocab);
      if (vocab.imageUrl) {
        // Add the new image to our images array
        setImages(prevImages => {
          const exists = prevImages.some(img => img.url === vocab.imageUrl);
          if (exists) return prevImages;
          return [{
            id: `vocab-${Date.now()}`,
            url: vocab.imageUrl,
            word: vocabularyWord || "vocabulary"
          }, ...prevImages];
        });
      }
    };
    
    // Handle direct agent-generated images
    const handleAgentImageEvent = (event: any) => {
      const imageData = event.detail;
      console.log('Received agent-generated image:', imageData.word);
      
      setImages(prevImages => {
        // Avoid duplicates
        const exists = prevImages.some(img => 
          img.url === imageData.url || 
          (img.word === imageData.word && img.id === imageData.id)
        );
        if (exists) return prevImages;
        return [imageData, ...prevImages];
      });
    };

    // Register event listeners
    window.addEventListener('vocab-image-generated', handleVocabImageEvent);
    window.addEventListener('agent-image-generated', handleAgentImageEvent);
    
    // Cleanup function
    return () => {
      window.removeEventListener('vocab-image-generated', handleVocabImageEvent);
      window.removeEventListener('agent-image-generated', handleAgentImageEvent);
    };
  }, [vocabularyWord]);
  
  // Listen for newly generated AI images to display in the gallery
  useEffect(() => {
    const handleAIImageGenerated = (event: any) => {
      const { imageUrl, imageId } = event.detail;
      
      // Add the new image to our list
      if (imageUrl) {
        setImages(prevImages => {
          // Check for duplicates
          const exists = prevImages.some(img => img.url === imageUrl);
          if (exists) return prevImages;
          
          return [{
            id: imageId || `ai-${Date.now()}`,
            url: imageUrl,
            word: vocabularyWord || "vocabulary"
          }, ...prevImages];
        });
      }
    };
    
    window.addEventListener('ai-image-generated', handleAIImageGenerated);
    
    return () => {
      window.removeEventListener('ai-image-generated', handleAIImageGenerated);
    };
  }, [vocabularyWord]);

  // Automatic trigger for image generation when word changes
  useEffect(() => {
    // Generate an image for serendipity when the page loads
    const generateSerendipityImage = async () => {
      try {
        setIsGeneratingAI(true);
        const prompt = "A person stumbling upon a hidden treasure chest while walking in a forest. Make this beautiful, detailed, high resolution.";
        const word = "serendipity";
        
        const response = await fetch('/api/ai/gemini-generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt, context: word }),
        });

        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }

        const data = await response.json();
        if (data.imageData) {
          setImages(prevImages => [...prevImages, { 
            id: `manual-${Date.now()}`,
            url: `data:image/png;base64,${data.imageData}`,
            word: word
          }]);
        }
      } catch (error) {
        console.error('Error generating image:', error);
      } finally {
        setIsGeneratingAI(false);
      }
    };

    generateSerendipityImage();
  }, []);
  
  // Handle form submission
  const handleSubmit = (inputPrompt: string) => {
    setPrompt(inputPrompt);
    onGenerateImage(inputPrompt);
  };
  
  return (
    <div className="vocab-image-gallery-container">
      {/* Input for generating images */}
      <div className="image-generation-input mb-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="flex items-center mb-3">
          <svg className="w-6 h-6 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          <h3 className="text-lg font-semibold">AI Image Assistant</h3>
        </div>
        
        <p className="text-gray-600 mb-3">Generate an image to help remember <strong className="text-blue-600">{vocabularyWord}</strong></p>
        
        <TextInput 
          onSubmit={handleSubmit}
          isLoading={isGeneratingAI}
          placeholder={`Draw a visual for '${vocabularyWord}'`}
          buttonText="Generate"
        />
      </div>
      
      {/* Image display area */}
      <div className="image-gallery mt-4">
        {isGeneratingAI && (
          <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200 animate-pulse">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-3 text-gray-600">{loadingText}</p>
            </div>
          </div>
        )}
        
        {!isGeneratingAI && images.length === 0 && (
          <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <div className="text-center p-6">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No images yet</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by generating an image.</p>
            </div>
          </div>
        )}
        
        {/* Image Gallery */}
        <div className="mt-6">
          <h3 className="text-xl font-semibold mb-4">Image Gallery</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {images.map((image, index) => (
              <div key={image.id} className="border rounded-lg overflow-hidden">
                <img 
                  src={image.url} 
                  alt={`Generated image for ${image.word}`} 
                  className="w-full h-auto"
                />
                <div className="p-2 bg-gray-50">
                  <p className="text-sm text-gray-500">Image for "{image.word}"</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function VocabNewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [userName, setUserName] = useState('');
  const [currentWordId, setCurrentWordId] = useState('');
  const [vocabWords, setVocabWords] = useState<VocabularyItem[]>([]);
  const [currentWord, setCurrentWord] = useState<VocabularyItem>(defaultVocabWord);
  const [isPromptLoading, setIsPromptLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Access the isGeneratingAI state directly from the store using Zustand hooks
  const isGeneratingAI = useCanvasStore(state => state.isGeneratingAI);
  
  // Room configuration for API calls
  const roomName = 'VocabNewPageRoom';  // Completely unique room name for this new page
  
  // Set username from auth or localStorage
  useEffect(() => {
    // Use session data if available, otherwise fallback to local storage
    if (session && session.user && session.user.email) {
      setUserName(session.user.email);
    } else {
      const storedUserName = localStorage.getItem('userName') || 'deepSinghYadav@gmail.com';
      setUserName(storedUserName);
    }
  }, [session]);
  
  // Fetch vocab words on component mount
  useEffect(() => {
    fetchVocabWords();
  }, [searchParams]); // Re-run this when URL params change
  
  const fetchVocabWords = () => {
    try {
      setLoading(true);
      // Get wordId from URL query parameters if available
      const wordIdFromUrl = searchParams?.get('wordId');
      
      // Available word IDs from our local data
      const availableIds = Object.keys(vocabData);
      
      // Use the wordId from URL or default to the first in our list
      const targetWordId = wordIdFromUrl || availableIds[0];
      setCurrentWordId(targetWordId);
      
      // Get the selected vocabulary word from local data
      const wordData = vocabData[targetWordId as keyof typeof vocabData];
      
      if (wordData) {
        // Format current word for consistent data structure
        const formattedWord: VocabularyItem = {
          id: wordData.wordId,
          word: wordData.wordText,
          partOfSpeech: '',
          definition: wordData.definition,
          exampleSentence: wordData.exampleSentence
        };
        
        // Set current word
        setCurrentWord(formattedWord);
        
        // Get other words for navigation
        const otherWords = availableIds
          .filter(id => id !== targetWordId)
          .map(id => {
            const word = vocabData[id as keyof typeof vocabData];
            return {
              id: word.wordId,
              word: word.wordText,
              partOfSpeech: '',
              definition: word.definition,
              exampleSentence: word.exampleSentence
            };
          });
        
        setVocabWords([formattedWord, ...otherWords]);
      } else {
        setError(`Vocabulary word with ID "${targetWordId}" not found`); 
      }
    } catch (err) {
      console.error('Error loading vocabulary words:', err);
      setError('Failed to load vocabulary words. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle leaving the room
  const handleLeave = () => {
    router.push('/roxpage');
  };
  
  // Handle submitting a prompt to generate an image
  const handlePromptSubmit = async (prompt: string) => {
    // Expose this function globally so VocabDirectActionHandler can use it
    if (typeof window !== 'undefined') {
      (window as any).__vocabpage_handlePromptSubmit = handlePromptSubmit;
    }
    if (!prompt.trim()) return;
    
    setIsPromptLoading(true);
    useCanvasStore.getState().setIsGeneratingAI(true);
    
    try {
      // Generate an enhanced prompt with the vocabulary context
      const enhancedPrompt = `${prompt}. This is for the vocabulary word "${currentWord.word}" and should help illustrate its meaning.`;
      
      // Make the API call to generate an image with Gemini
      const response = await fetch('/api/ai/gemini-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: enhancedPrompt,
          context: currentWord.word, // Include the vocabulary word as context
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate image: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.imageData) {
        const imageUrl = `data:image/png;base64,${data.imageData}`;
        
        // Dispatch a custom event with the image URL for our Image Gallery to catch
        try {
          const imageEvent = new CustomEvent('vocab-image-generated', {
            detail: {
              imageUrl,
              word: currentWord.word,
              prompt
            }
          });
          window.dispatchEvent(imageEvent);
          console.log('Image event dispatched successfully');
        } catch (eventError) {
          console.error('Error dispatching image event:', eventError);
        }
      } else {
        throw new Error('No image data returned from API');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      
      // Show a user-friendly error notification
      alert('Could not generate image. Please try again.');
      
      // Clear states
      setIsPromptLoading(false);
      useCanvasStore.getState().setIsGeneratingAI(false);
    } finally {
      setIsPromptLoading(false);
      setTimeout(() => {
        useCanvasStore.getState().setIsGeneratingAI(false);
      }, 500);
    }
  };
  
  // Handle moving to next word
  const handleNextWord = (): void => {
    // Find the next word in our vocabulary list
    if (vocabWords.length > 0) {
      const currentIndex = vocabWords.findIndex(word => word.id === currentWord.id);
      const nextIndex = (currentIndex + 1) % vocabWords.length;
      const nextWord = vocabWords[nextIndex];
      
      // Navigate to the same page with a new word ID
      router.push(`/vocabnewpage?wordId=${nextWord.id}`);
      console.log('Navigating to next word:', nextWord.id);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Action handlers for processing agent commands */}
      <VocabAgentActionHandler />
      <BrowserOnly>
        <ClientImageHandler />
      </BrowserOnly>
      
      {/* Main content */}
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header with navigation */}
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Vocabulary Practice</h1>
          <button 
            className="px-4 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-md transition-colors flex items-center"
            onClick={handleLeave}
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
            </svg>
            Exit
          </button>
        </header>
        
        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading vocabulary data...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg">
            <p>{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column: Word info and navigation */}
            <div className="col-span-1">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">{currentWord.word}</h2>
                <p className="text-gray-700 mb-4">{currentWord.definition}</p>
                {currentWord.exampleSentence && (
                  <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 mb-4">
                    "{currentWord.exampleSentence}"
                  </blockquote>
                )}
                
                <button 
                  className="mt-4 w-full px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-md transition-colors flex items-center justify-center"
                  onClick={handleNextWord}
                >
                  <span>Next Word</span>
                  <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                  </svg>
                </button>
              </div>
              
              {/* LiveKit integration */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold mb-4">AI Vocabulary Teacher</h3>
                <div className="h-[300px] rounded-lg overflow-hidden bg-gray-50">
                  <LiveKitSession
                    roomName="VocabNewPageRoom"  // Completely unique room name for this new page
                    userName={userName || "Anonymous User"}
                    pageType="vocab"  // Using the valid existing PageType
                    sessionTitle="Vocabulary Visual Learning"
                    aiAssistantEnabled={true}
                    hideVideo={false}
                    hideAudio={false}
                    showTimer={false}
                  />
                </div>
              </div>
            </div>
            
            {/* Right column: Image gallery */}
            <div className="col-span-1 lg:col-span-2">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-xl font-semibold mb-4">Visual Learning</h3>
                <VocabImageGallery 
                  vocabularyWord={currentWord.word}
                  onGenerateImage={handlePromptSubmit}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VocabNewPage() {
  return (
    <ProtectedRoute>
      <VocabNewPageContent />
    </ProtectedRoute>
  );
}
