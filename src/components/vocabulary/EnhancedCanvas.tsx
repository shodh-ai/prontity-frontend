'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useCanvasStore } from '@/state/canvasStore';
import SimpleCanvas from './SimpleCanvas';
import GeminiDrawingCanvas from './GeminiDrawingCanvas';
import { Sparkles, Palette, ArrowLeft } from 'lucide-react';

interface EnhancedCanvasProps {
  apiKey?: string;
  className?: string;
}

const EnhancedCanvas: React.FC<EnhancedCanvasProps> = ({ apiKey, className = '' }) => {
  const [mode, setMode] = useState<'standard' | 'gemini'>('standard');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const elements = useCanvasStore((state) => state.elements);
  const addElement = useCanvasStore((state) => state.addElement);
  
  // Handle image generated from Gemini
  const handleGeminiImageGenerated = (imageUrl: string) => {
    setGeneratedImageUrl(imageUrl);
  };
  
  // Handle importing Gemini image into SimpleCanvas when switching back
  const handleImportGeminiImage = () => {
    if (generatedImageUrl) {
      // Add the generated image to the canvas store
      const id = `image-${Date.now()}`;
      
      addElement({
        id,
        type: 'image',
        x: 50,
        y: 50,
        width: 400,
        height: 300,
        url: generatedImageUrl,
        metadata: {
          prompt: 'Generated with Gemini',
          source: 'gemini'
        }
      });
    }
    
    // Switch back to standard mode
    setMode('standard');
  };

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Mode selector */}
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        {mode === 'gemini' && (
          <button
            onClick={handleImportGeminiImage}
            className="flex items-center gap-2 bg-white/90 hover:bg-white px-3 py-2 rounded-md shadow-sm text-sm font-medium text-gray-700 border border-gray-200 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Import & Return</span>
          </button>
        )}
        
        <button
          onClick={() => setMode(mode === 'standard' ? 'gemini' : 'standard')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md shadow-sm text-sm font-medium transition-colors ${
            mode === 'standard' 
              ? 'bg-white/90 hover:bg-white text-gray-700 border border-gray-200' 
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          {mode === 'standard' ? (
            <>
              <Sparkles size={16} />
              <span>Switch to Gemini AI</span>
            </>
          ) : (
            <>
              <Palette size={16} />
              <span>Switch to Standard</span>
            </>
          )}
        </button>
      </div>
      
      {/* Canvas components */}
      <div className="w-full h-full">
        {mode === 'standard' ? (
          <SimpleCanvas />
        ) : (
          <div className="w-full h-full bg-white">
            <GeminiDrawingCanvas 
              apiKey={apiKey} 
              onImageGenerated={handleGeminiImageGenerated}
              className="bg-white"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedCanvas;
