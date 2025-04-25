'use client';

import React, { useState } from 'react';
import { useCanvasStore } from '@/state/canvasStore';

interface AIPromptInputProps {
  onSubmit: (prompt: string) => void;
  loading?: boolean;
}

const AIPromptInput: React.FC<AIPromptInputProps> = ({ 
  onSubmit,
  loading = false
}) => {
  const [prompt, setPrompt] = useState('');
  const { isGeneratingAI } = useCanvasStore();
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !loading && !isGeneratingAI) {
      onSubmit(prompt.trim());
      setPrompt('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center space-x-2 w-full">
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Ask AI to draw something..."
        disabled={loading || isGeneratingAI}
      />
      <button
        type="submit"
        className={`px-4 py-2 rounded-lg text-white ${
          loading || isGeneratingAI
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-[#566FE9] hover:bg-[#4056c9]'
        }`}
        disabled={loading || isGeneratingAI || !prompt.trim()}
      >
        {loading || isGeneratingAI ? (
          <div className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing
          </div>
        ) : (
          'Ask AI to Draw'
        )}
      </button>
    </form>
  );
};

export default AIPromptInput;
