'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import LiveKitSession from '@/components/LiveKitSession';
import { useCanvasStore } from '@/state/canvasStore';
import VocabBox, { VocabularyItem } from '@/components/vocabulary/VocabBox';
import dynamic from 'next/dynamic';

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
  
  // Access the isGeneratingAI state directly from the store using Zustand hooks
  const isGeneratingAI = useCanvasStore(state => state.isGeneratingAI);
  
  // Use useCallback for functions that call store methods to prevent unnecessary re-renders
  const loadCanvasState = useCallback((userId: string, wordId: string) => {
    useCanvasStore.getState().loadCanvasState(userId, wordId);
  }, []);
  
  const saveCanvasState = useCallback((userId: string, wordId: string) => {
    return useCanvasStore.getState().saveCanvasState(userId, wordId);
  }, []);
  
  // Room configuration
  const roomName = 'VocabularyPractice';
  
  // Example vocabulary task instructions
  const vocabInstructions = "In this vocabulary practice, we'll review key academic terms that frequently appear in TOEFL exams. You can draw, define, or practice using these words in context.";
  
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
  
  // Handle AI prompt submission
  const handlePromptSubmit = async (prompt: string) => {
    setIsPromptLoading(true);
    
    // Set the AI generation loading state
    useCanvasStore.getState().setIsGeneratingAI(true);
    
    try {
      // Call our API endpoint for Gemini image generation
      const response = await fetch('/api/ai/generate-drawing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
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
      
      // Add the image to the canvas using handleAIImageCommand
      useCanvasStore.getState().handleAIImageCommand({
        imageId: imageData.imageId,
        imageUrl: imageData.imageUrl,
        width: imageData.width,
        height: imageData.height,
        placementHint: 'center' // Optional hint for placement logic
      });
      
      // Also save the updated canvas state after adding the image
      setTimeout(() => {
        if (userName) {
          const currentWord = sampleVocabWords[currentWordIndex];
          saveCanvasState(userName, currentWord.id);
        }
      }, 500);
      
    } catch (error) {
      console.error('Error generating AI image:', error);
      alert(`Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`); 
    } finally {
      // Reset loading states
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
  
  // Custom canvas controls component
  const VocabCanvasControls = () => {
    const currentWord = sampleVocabWords[currentWordIndex];
    
    return (
      <div className="vocab-canvas-container">
        {/* Vocabulary Display Component */}
        <VocabBox vocabularyItem={currentWord} />
        
        {/* Tool Bar with integrated controls */}
        <div className="toolbar-container mb-4">
          <div className="flex justify-between items-center">
            <ToolBar />
            
            <button 
              className="next-word-btn px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg ml-4"
              onClick={handleNextWord}
            >
              Next Word
            </button>
          </div>
        </div>
        
        {/* Canvas Component (Client-side only with simplified implementation) */}
        <SimpleCanvas />
        
        {/* AI Drawing Prompt Input */}
        <div className="mt-6 mb-4">
          <div className="p-3 bg-gray-50 rounded border border-gray-200">
            <h3 className="text-md font-semibold mb-2">AI Drawing Assistant</h3>
            <p className="text-sm text-gray-600 mb-3">Ask the AI to draw something to help you remember the word "<strong>{currentWord.word}</strong>"</p>
            <TextInput 
              onSubmit={handlePromptSubmit}
              isLoading={isPromptLoading || isGeneratingAI}
              placeholder="E.g., 'Draw a person looking confused between two choices' for 'Ambiguous'"
              buttonText="Generate Drawing"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page-wrapper">
      <LiveKitSession
        roomName={roomName}
        userName={userName || 'student-user'}
        questionText={vocabInstructions}
        sessionTitle="Vocabulary Practice"
        pageType="vocab"
        hideVideo={false} // Show video for AI teacher feed
        customControls={<VocabCanvasControls />}
        onLeave={handleLeave}
        aiAssistantEnabled={true}
      />
    </div>
  );
}
