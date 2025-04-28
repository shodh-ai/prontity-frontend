'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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

// Sample vocabulary words for demonstration
const sampleVocabWords: VocabularyItem[] = [
  {
    id: 'word1',
    word: 'Ambiguous',
    partOfSpeech: 'adjective',
    definition: 'Open to more than one interpretation; having a double meaning.',
    exampleSentence: 'The conclusion of the story was ambiguous, leaving readers to decide for themselves what happened.'
  },
  {
    id: 'word2',
    word: 'Pragmatic',
    partOfSpeech: 'adjective',
    definition: 'Dealing with things sensibly and realistically in a way that is based on practical considerations.',
    exampleSentence: 'She made a pragmatic decision to sell her car and use public transportation instead.'
  },
  {
    id: 'word3',
    word: 'Ubiquitous',
    partOfSpeech: 'adjective',
    definition: 'Present, appearing, or found everywhere.',
    exampleSentence: 'Mobile phones have become ubiquitous in modern society.'
  }
];

function VocabPageContent() {
  const router = useRouter();
  const { data: session } = useSession();
  const [userName, setUserName] = useState('');
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isPromptLoading, setIsPromptLoading] = useState(false);
  const [promptText, setPromptText] = useState('');
  
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
  
  // Load canvas state when word changes
  useEffect(() => {
    if (userName) {
      const currentWord = sampleVocabWords[currentWordIndex];
      loadCanvasState(userName, currentWord.id);
    }
  }, [userName, currentWordIndex, loadCanvasState]);

  // Handle leaving the room
  const handleLeave = () => {
    // Save before leaving
    if (userName) {
      const currentWord = sampleVocabWords[currentWordIndex];
      saveCanvasState(userName, currentWord.id);
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
          context: sampleVocabWords[currentWordIndex].word
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
          // Fallback to default dimensions if image preloading fails
          useCanvasStore.getState().handleAIImageCommand({
            imageId: `gemini-${Date.now()}`,
            imageUrl: imageUrl,
            width: 400,
            height: 300,
            placementHint: 'center'
          });
          
          // Clear states even if there was an error
          setIsPromptLoading(false);
          setPromptText('');
          useCanvasStore.getState().setIsGeneratingAI(false);
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
    // Save current state first
    if (userName) {
      const currentWord = sampleVocabWords[currentWordIndex];
      saveCanvasState(userName, currentWord.id).then(() => {
        // Then move to next word
        setCurrentWordIndex((prevIndex: number) => 
          (prevIndex + 1) % sampleVocabWords.length
        );
      });
    }
  };

  // Custom canvas controls component with improved UI
  const VocabCanvasControls = () => {
    const currentWord = sampleVocabWords[currentWordIndex];
    
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
          <VocabCanvas vocabularyWord={currentWord.word} definition={currentWord.definition} userId={userName} wordId={currentWord.id} />
        </div>
        
        {/* AI Drawing Prompt Input */}
        <div className="mb-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            <h3 className="text-lg font-semibold">AI Drawing Assistant</h3>
          </div>
          
          <p className="text-gray-600 mb-3">Generate an image to help remember <strong className="text-blue-600">{currentWord.word}</strong></p>
          
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
              <h2 className={styles.wordTitle}>{sampleVocabWords[currentWordIndex].word}</h2>
              <p className={styles.wordDetails}>
                {sampleVocabWords[currentWordIndex].partOfSpeech} {sampleVocabWords[currentWordIndex].definition}
                <br/>
                "{sampleVocabWords[currentWordIndex].exampleSentence}"
              </p>
            </div>
            
            {/* Canvas area */}
            <VocabCanvas 
              vocabularyWord={sampleVocabWords[currentWordIndex].word}
              definition={sampleVocabWords[currentWordIndex].definition}
              userId={userName}
              wordId={sampleVocabWords[currentWordIndex].id}
            />
            
            {/* Clean image generation prompt box matching the design in the image */}
            <div className={styles.promptInputContainer}>
              <div className="flex justify-between mb-1">
                <div className="text-sm font-medium text-gray-600">Generate Image with Gemini AI</div>
              </div>
              <div className="relative">
                <input
                  type="text" 
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder={`Describe an image that illustrates "${sampleVocabWords[currentWordIndex].word}"...`}
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handlePromptSubmit(promptText);
                    }
                  }}
                  disabled={isPromptLoading || isGeneratingAI}
                />
                <button 
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 px-3 py-0.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  onClick={() => handlePromptSubmit(promptText)}
                  disabled={isPromptLoading || isGeneratingAI || !promptText.trim()}
                >
                  {isPromptLoading || isGeneratingAI ? (
                    <div className="flex items-center py-0.5">
                      <svg className="animate-spin mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </div>
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </div>
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
        
        {/* Footer controls with Next Word button */}
        <div className={styles.footerControls}>
          <button className={styles.nextWordButton} onClick={handleNextWord}>
            Next Word
          </button>
        </div>
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
