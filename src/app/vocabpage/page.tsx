'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCanvasStore } from '@/state/canvasStore';
import VocabBox, { VocabularyItem } from '@/components/vocabulary/VocabBox';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import LiveKitSession from '@/components/LiveKitSession';

// Import CSS Module
import styles from './vocabpage.module.css';

// Import the SimpleCanvas component with SSR disabled completely
const SimpleCanvas = dynamic(
  () => import('@/components/vocabulary/SimpleCanvas'),
  { ssr: false }
);
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

export default function VocabPage() {
  const router = useRouter();
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
  
  // Get username from localStorage when component mounts
  useEffect(() => {
    const storedUserName = localStorage.getItem('userName');
    if (storedUserName) {
      setUserName(storedUserName);
    } else {
      // Redirect to login if no username found
      router.push('/loginpage');
    }
  }, [router]);
  
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
      // Call our API endpoint for Gemini image generation
      const response = await fetch('/api/ai/generate-drawing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          context: sampleVocabWords[currentWordIndex].word,
          userId: userName
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      // Get the generated image data
      const imageData = await response.json();
      
      if (imageData.error) {
        throw new Error(imageData.error);
      }
      
      // Add the image to the canvas using handleAIImageCommand with the correct parameter shape
      useCanvasStore.getState().handleAIImageCommand({
        imageId: imageData.imageId || Date.now().toString(),
        imageUrl: imageData.imageUrl,
        width: imageData.width || 300,
        height: imageData.height || 300,
        placementHint: 'center' // Optional hint for placement logic
      });
      
      // Clear the prompt text after submission
      setPromptText('');
      
      // Also save the updated canvas state after adding the image
      setTimeout(() => {
        if (userName) {
          const currentWord = sampleVocabWords[currentWordIndex];
          saveCanvasState(userName, currentWord.id);
        }
      }, 500);
    } catch (error) {
      console.error('Error submitting prompt:', error);
      alert('Failed to generate image. Please try again.');
    } finally {
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
          <SimpleCanvas />
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
            <div className={styles.canvasContainer}>
              <SimpleCanvas />
              <div className={styles.scrollIndicator}>
                <div className={styles.scrollThumb}></div>
              </div>
            </div>
            
            {/* Prompt input */}
            <div className={styles.promptInput}>
              <input 
                type="text" 
                className={styles.inputField}
                placeholder="Type to generate a image"
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
                className={styles.submitButton} 
                onClick={() => handlePromptSubmit(promptText)}
                disabled={isPromptLoading || isGeneratingAI}
              >
                <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 1L7.5 8.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M15 1L10 15L7.5 8.5L1 6L15 1Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
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
        
        {/* Footer controls */}
        <div className={styles.footerControls}>
          <button className={styles.nextWordButton} onClick={handleNextWord}>
            Next Word
          </button>
        </div>
        
        {/* LiveKit session for the control buttons */}
        <div className={styles.mediaControlsContainer}>
          <LiveKitSession
            roomName={roomName}
            userName={userName || 'student-user'}
            sessionTitle=""
            pageType="vocab"
            hideVideo={true}
            onLeave={handleLeave}
            aiAssistantEnabled={false}
          />
        </div>
      </div>
    </div>
  );
}
