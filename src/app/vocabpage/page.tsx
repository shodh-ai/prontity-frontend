'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCanvasStore } from '@/state/canvasStore';
import VocabBox, { VocabularyItem } from '@/components/vocabulary/VocabBox';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import LiveKitSession from '@/components/LiveKitSession';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useSession } from 'next-auth/react';

// Import CSS Module
import styles from './vocabpage.module.css';

// Import the VocabCanvas component
import VocabCanvas from '@/components/vocabulary/VocabCanvas';

import ToolBar from '@/components/vocabulary/ToolBar';
import TextInput from '@/components/vocabulary/TextInput';

// Comment out API clients for now
// import contentApi from '@/api/contentService';
// import userProgressApi from '@/api/userProgressService';

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

// Sample vocabulary word IDs from the API documentation
const availableVocabIds = ['ubiquitous', 'ameliorate', 'ephemeral', 'serendipity'];


function VocabPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [userName, setUserName] = useState('');
  const [currentWordId, setCurrentWordId] = useState('');
  const [vocabWords, setVocabWords] = useState<VocabularyItem[]>([]);
  const [currentWord, setCurrentWord] = useState<VocabularyItem>(defaultVocabWord);
  const [isPromptLoading, setIsPromptLoading] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Access the isGeneratingAI state directly from the store using Zustand hooks
  const isGeneratingAI = useCanvasStore(state => state.isGeneratingAI);
  
  // Use useCallback for functions that call store methods to prevent unnecessary re-renders
  const loadCanvasState = useCallback((userId: string, wordId: string) => {
    useCanvasStore.getState().loadCanvasState(userId, wordId);
  }, []);
  
  const saveCanvasState = useCallback((userId: string, wordId: string) => {
    return useCanvasStore.getState().saveCanvasState(userId, wordId);
  }, []);
  
  // Room configuration for API calls
  const roomName = 'VocabularyPractice';
  
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
  }, [session]);
  
  // Fetch vocabulary words from local dummy data
  useEffect(() => {
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
          // Format the data to match our VocabularyItem interface
          const formattedWord: VocabularyItem = {
            id: wordData.wordId,
            word: wordData.wordText,
            partOfSpeech: '', // API doesn't include part of speech
            definition: wordData.definition,
            exampleSentence: wordData.exampleSentence || '',
          };
          
          setCurrentWord(formattedWord);
          console.log('Loaded vocabulary word:', wordData.wordText, 'with ID:', targetWordId);
          
          // Also load other vocab words for navigation
          const otherWords = availableIds
            .filter(id => id !== targetWordId)
            .map(id => {
              const word = vocabData[id as keyof typeof vocabData];
              return {
                id: word.wordId,
                word: word.wordText,
                partOfSpeech: '',
                definition: word.definition,
                exampleSentence: word.exampleSentence || '',
              } as VocabularyItem;
            });
            
          setVocabWords([formattedWord, ...otherWords]);
          
          // Simulate loading the user's saved canvas for this vocabulary word
          console.log('Would load canvas state for user:', userName, 'and word:', targetWordId);
          // In a real app, this would call:
          // loadCanvasState(userName, targetWordId);
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
    
    if (userName) {
      fetchVocabWords();
    }
  }, [userName, searchParams]);
  
  // Load canvas state when word changes
  useEffect(() => {
    if (userName && currentWord.id !== 'default') {
      loadCanvasState(userName, currentWord.id);
    }
  }, [userName, currentWord, loadCanvasState]);

  // Handle leaving the room
  const handleLeave = () => {
    // Simulated progress recording (local only, no API call)
    try {
      const token = localStorage.getItem('token');
      if (token && currentWord) {
        // Simulate saving canvas state
        console.log('Would save canvas state for user:', userName, 'and word:', currentWord.id);
        // In a real app, this would call:
        // const canvasData = saveCanvasState(userName, currentWord.id);
        
        // Simulate recording task completion
        console.log('Would record task completion for word:', currentWord.id, 'with score:', 100);
        console.log('Task data:', { 
          vocabCompleted: true,
          canvasData: 'simulated-canvas-data',
          testSize: 'large' 
        });
        
        // In a real app, this would call:
        // userProgressApi.recordTaskCompletion(
        //   currentWord.id, 
        //   100,
        //   { 
        //     vocabCompleted: true,
        //     canvasData: canvasData,
        //     testSize: 'large' 
        //   },
        //   undefined,
        //   true
        // );
      }
    } catch (err) {
      console.error('Error recording task completion:', err);
    }
    
    router.push('/roxpage');
  };
  
  // Handle submitting a prompt to generate an image
  const handlePromptSubmit = async (prompt: string) => {
    if (!prompt.trim()) return;
    
    setIsPromptLoading(true);
    useCanvasStore.getState().setIsGeneratingAI(true);
    
    try {
      // Get the current canvas content as an image
      const stageElement = document.querySelector('canvas');
      let imageData;
      
      if (stageElement) {
        // Capture the current canvas as a data URL
        const dataUrl = stageElement.toDataURL('image/png');
        // Remove the data URL prefix for the API
        imageData = dataUrl.split(',')[1];
      }
      
      // Call our Gemini API endpoint
      const response = await fetch('/api/ai/gemini-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          imageData,
          context: currentWord.word
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.imageData) {
        // Convert the base64 image data to a data URL
        const imageUrl = `data:image/png;base64,${data.imageData}`;
        
        console.log('Generated image URL:', imageUrl.substring(0, 50) + '...');
        
        // Pre-load the image to get the actual dimensions
        const img = document.createElement('img');
        img.onload = () => {
          // Once image is loaded, we know its dimensions
          console.log('Image loaded successfully with dimensions:', img.width, img.height);
          
          // Add image to canvas with actual dimensions
          useCanvasStore.getState().handleAIImageCommand({
            imageId: `gemini-${Date.now()}`,
            imageUrl: imageUrl,
            width: img.width || 400, // Use actual width or default
            height: img.height || 300, // Use actual height or default
            placementHint: 'center' // Place in center of viewport
          });
          
          // Clear the loading state and prompt text after successful generation
          setIsPromptLoading(false);
          setPromptText('');
          // Delayed reset of generating state
          setTimeout(() => {
            useCanvasStore.getState().setIsGeneratingAI(false);
          }, 500);
        };
        img.onerror = (event: Event | string) => {
          console.error('Failed to preload image:', event);
          // Set the generated image URL in state to display it
          setGeneratedImageUrl(imageUrl);
          
          // Simply mark the generation as complete
          useCanvasStore.getState().setIsGeneratingAI(false);
          
          setIsPromptLoading(false);
          setPromptText('');
          // Delayed reset of generating state
          setTimeout(() => {
            useCanvasStore.getState().setIsGeneratingAI(false);
          }, 500);
        };
        // Start loading the image
        img.src = imageUrl;
      }
      
    } catch (error) {
      console.error('Error generating image:', error);
      
      // Show a user-friendly error notification
      const errorMessage = document.createElement('div');
      errorMessage.className = styles.errorNotification;
      errorMessage.textContent = 'Could not generate image. Please try again.';
      document.body.appendChild(errorMessage);
      
      // Remove notification after 3 seconds
      setTimeout(() => {
        errorMessage.classList.add(styles.fadeOut);
        setTimeout(() => {
          document.body.removeChild(errorMessage);
        }, 500);
      }, 3000);
      
      // Clear states
      setIsPromptLoading(false);
      useCanvasStore.getState().setIsGeneratingAI(false);
    }
  };

  // Handle moving to next word
  const handleNextWord = (): void => {
    // Simulate saving canvas state and recording task completion
    try {
      if (currentWord) {
        console.log('Would save canvas state for user:', userName, 'and word:', currentWord.id);
        // In a real app, this would call:
        // saveCanvasState(userName, currentWord.id);
      }
      
      // Simulate recording task completion if logged in
      const token = localStorage.getItem('token');
      if (token && currentWord) {
        console.log('Would record task completion for word:', currentWord.id, 'with score:', 100);
        console.log('Task data:', { 
          vocabCompleted: true,
          canvasData: 'submitted',
          testSize: 'large' 
        });
        
        // In a real app, this would call:
        // userProgressApi.recordTaskCompletion(
        //   currentWord.id,
        //   100, 
        //   { 
        //     vocabCompleted: true,
        //     canvasData: 'submitted',
        //     testSize: 'large' 
        //   },
        //   undefined,
        //   true
        // );
      }
    } catch (err) {
      console.error('Error recording task completion:', err);
    }
    
    // Find the next word in our vocabulary list
    if (vocabWords.length > 0) {
      const currentIndex = vocabWords.findIndex(word => word.id === currentWord.id);
      const nextIndex = (currentIndex + 1) % vocabWords.length;
      const nextWord = vocabWords[nextIndex];
      
      // Navigate to the same page with a new word ID
      router.push(`/vocabpage?wordId=${nextWord.id}`);
      console.log('Navigating to next word:', nextWord.id);
    }
  };  

  // Custom canvas controls component with improved UI
  const VocabCanvasControls = () => {
    // Use the current word from state
    
    return (
      <div className="vocab-canvas-container">
        {/* Header with word navigation */}
        <div className="flex justify-between items-center mb-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <VocabBox vocabularyItem={currentWord} />
          
          <button 
            className="next-word-btn px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-md transition-colors ml-4 flex items-center"
            onClick={handleNextWord}
          >
            <span>Next Word</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        {/* Tool Bar */}
        <div className="toolbar-container mb-4 bg-white p-3 rounded-lg shadow-sm border border-gray-100">
          <ToolBar />
        </div>
        
        {/* Canvas Component */}
        <div className="canvas-wrapper mb-4 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading vocabulary word...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 bg-red-50 text-red-600 rounded-lg p-4">
              <p>{error}</p>
            </div>
          ) : (
            <VocabCanvas 
              vocabularyWord={currentWord.word} 
              definition={currentWord.definition} 
              userId={userName} 
              wordId={currentWord.id} 
            />
          )}
        </div>
        
        {/* AI Drawing Prompt Input */}
        <div className="mb-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            <h3 className="text-lg font-semibold">AI Drawing Assistant</h3>
          </div>
          
          <p className="text-gray-600 mb-3">Generate an image to help remember <strong className="text-blue-600">{loading ? 'this word' : currentWord.word}</strong></p>
          
          <TextInput 
            onSubmit={handlePromptSubmit}
            isLoading={isPromptLoading || isGeneratingAI}
            placeholder={`Draw a visual for '${currentWord.word}'`}
            buttonText="Generate"
          />
        </div>
      </div>
    );
  };

  return (
    <div className={styles.pageContainer}>
      {/* Background elements */}
      <div className={styles.backgroundBlob1}></div>
      <div className={styles.backgroundBlob2}></div>
      <div className={styles.overlay}></div>
      
      {/* Main content card */}
      <div className={styles.mainCard}>
        {/* Close button */}
        <button className={styles.closeButton} onClick={handleLeave}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18" stroke="#717171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6 6L18 18" stroke="#717171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        
        {/* Header with progress */}
        <div className={styles.headerSection}>
          <h1 className={styles.sessionTitle}>Vocabulary Practice Session</h1>
          <div className={styles.progressBar}>
            <div className={styles.progressFill}></div>
          </div>
        </div>
        
        {/* Main content */}
        <div className={styles.contentSection}>
          <div className={styles.leftContent}>
            {/* Current word */}
            <div className={styles.wordSection}>
              <h2 className={styles.wordTitle}>{loading ? 'Loading...' : currentWord.word}</h2>
              <p className={styles.wordDetails}>
                {loading ? '' : currentWord.partOfSpeech} {loading ? 'Loading definition...' : currentWord.definition}
                <br/>
                {loading ? '' : currentWord.exampleSentence ? `"${currentWord.exampleSentence}"` : 'No example sentence available.'}
              </p>
            </div>
            
            {/* Canvas area */}
            {loading ? (
              <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading canvas...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-64 bg-red-50 text-red-600 rounded-lg p-4">
                <p>{error}</p>
              </div>
            ) : (
              <VocabCanvas 
                vocabularyWord={currentWord.word}
                definition={currentWord.definition}
                userId={userName}
                wordId={currentWord.id}
              />
            )}
            
            {/* Removed duplicate Gemini AI prompt input - using the one in VocabCanvas instead */}
          </div>
          
          {/* User section */}
          <div className={styles.userSection}>
            <div className={styles.userCard} style={{backgroundImage: 'url(https://randomuser.me/api/portraits/men/34.jpg)'}}>
              <div className={styles.userLabel}>User</div>
            </div>
            <div className={styles.userCard} style={{backgroundImage: 'url(https://randomuser.me/api/portraits/women/44.jpg)'}}>
              <div className={styles.userLabel}>AI Vocabulary Teacher</div>
            </div>
          </div>
        </div>
        
        {/* Footer controls removed */}
      </div>
    </div>
  );
}

export default function VocabPage() {
  return (
    <ProtectedRoute>
      <VocabPageContent />
    </ProtectedRoute>
  );
}
