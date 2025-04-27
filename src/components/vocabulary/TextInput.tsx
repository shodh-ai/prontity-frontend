'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '@/state/canvasStore';

interface TextInputProps {
  onSubmit: (prompt: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  buttonText?: string;
}

const TextInput: React.FC<TextInputProps> = ({
  onSubmit,
  isLoading = false,
  placeholder = "Ask AI to draw something...",
  buttonText = "Generate"
}) => {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Get isGeneratingAI directly from the store with a selector
  const isGeneratingAIFromStore = useCanvasStore(state => state.isGeneratingAI);
  
  // Focus input on component mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);
  
  // When AI finishes generating, focus back on input for next prompt
  useEffect(() => {
    if (!isGeneratingAIFromStore && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isGeneratingAIFromStore]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (text.trim() && !isLoading && !isGeneratingAIFromStore) {
      onSubmit(text.trim());
      setText(''); // Clear input after submission
    }
  };
  
  // Only disable the submit button when loading or when text is empty
  // But NEVER disable the input field itself
  const isButtonDisabled = isLoading || isGeneratingAIFromStore || !text.trim();
  
  return (
    <div className="text-input-container w-full">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-grow">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#566FE9] focus:border-transparent placeholder-gray-400"
            placeholder={placeholder}
            disabled={isLoading || isGeneratingAIFromStore}
          />
          {text.trim().length > 0 && (
            <button
              type="button"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setText('')}
              aria-label="Clear input"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </button>
          )}
        </div>
        
        <button
          type="submit"
          className={`px-5 py-3 rounded-lg text-white font-medium transition-colors ${
            isButtonDisabled
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-[#566FE9] hover:bg-[#4056c9] shadow-sm'
          }`}
          disabled={isButtonDisabled}
        >
          {isLoading || isGeneratingAIFromStore ? (
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Generating...</span>
            </div>
          ) : (
            buttonText
          )}
        </button>
      </form>
      
      {/* Optional helper text */}
      <p className="text-xs text-gray-500 mt-2 ml-1">
        Type what you want the AI to draw, then press {buttonText} or Enter
      </p>
    </div>
  );
};

export default TextInput;
