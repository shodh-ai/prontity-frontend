'use client';

import React, { useState } from 'react';
import { NextPage } from 'next';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { Sparkles } from 'lucide-react';

// Import EnhancedCanvas dynamically with SSR disabled
const EnhancedCanvas = dynamic(
  () => import('../components/vocabulary/EnhancedCanvas'),
  { ssr: false }
);
// No memory utils needed for this demo

const EnhancedDrawingDemo: NextPage = () => {
  const [apiKey, setApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(true);
  const router = useRouter();

  const handleApiKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey) {
      setShowKeyInput(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {showKeyInput ? (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <div className="flex items-center mb-4">
              <Sparkles className="text-indigo-600 w-6 h-6 mr-2" />
              <h1 className="text-2xl font-bold">Enhanced Drawing Canvas</h1>
            </div>
            
            <p className="mb-6 text-gray-600">
              This demo combines our standard drawing tools with Gemini 2.0 AI image generation capabilities. 
              You'll be able to switch between modes and create drawings enhanced by AI.
            </p>
            
            <div className="mb-6 bg-blue-50 p-4 rounded-md border border-blue-200">
              <h2 className="font-semibold text-blue-800 mb-2">Key Features:</h2>
              <ul className="text-blue-700 list-disc pl-5 space-y-1 text-sm">
                <li>Switch between standard drawing and AI modes</li>
                <li>Generate AI images based on your drawings</li>
                <li>Make iterative changes to existing drawings</li>
                <li>Import AI-generated images back to standard canvas</li>
              </ul>
            </div>
            
            <form onSubmit={handleApiKeySubmit}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Google API Key (with Gemini access)
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Google API Key"
                className="w-full p-3 border border-gray-300 rounded mb-4"
                required
              />
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Start Enhanced Drawing</span>
              </button>
            </form>
            <div className="mt-4 text-sm text-gray-500">
              <p>You can obtain a Google API Key from the <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">Google AI Studio</a>.</p>
              <p className="mt-2">Make sure your API key has access to Gemini 2.0 models.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative w-full h-screen">
          <button
            onClick={handleGoBack}
            className="absolute top-4 left-4 z-50 bg-white p-2 rounded-full shadow-md hover:bg-gray-100 transition-colors"
          >
            ← Back
          </button>
          <EnhancedCanvas apiKey={apiKey} />
        </div>
      )}
    </div>
  );
};

export default EnhancedDrawingDemo;
