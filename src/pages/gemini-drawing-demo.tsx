'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';

// Import GeminiDrawingCanvas dynamically with SSR disabled
const GeminiDrawingCanvas = dynamic(
  () => import('../components/vocabulary/GeminiDrawingCanvas'),
  { ssr: false }
);

export default function GeminiDrawingDemo() {
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
            <h1 className="text-2xl font-bold mb-4">Enter Google API Key</h1>
            <p className="mb-4 text-gray-600">
              To use the Gemini drawing canvas, you need to provide a Google API key with access to the Gemini API.
            </p>
            <form onSubmit={handleApiKeySubmit}>
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
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
              >
                Continue
              </button>
            </form>
            <div className="mt-4 text-sm text-gray-500">
              <p>You can obtain a Google API Key from the <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google AI Studio</a>.</p>
              <p className="mt-2">Make sure your API key has access to the Gemini 2.0 models.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative">
          <button
            onClick={handleGoBack}
            className="absolute top-4 left-4 bg-white p-2 rounded-full z-10 shadow-md"
          >
            ← Back
          </button>
          <GeminiDrawingCanvas apiKey={apiKey} />
        </div>
      )}
    </div>
  );
}
