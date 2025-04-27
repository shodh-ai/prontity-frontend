'use client';

import React, { useState, useRef } from 'react';
import { LoaderCircle } from 'lucide-react';

export default function GeminiTest() {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw a simple shape on the canvas
  const drawOnCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw a simple shape
    ctx.fillStyle = "#ff0000";
    ctx.beginPath();
    ctx.arc(canvas.width/2, canvas.height/2, 50, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw some text
    ctx.fillStyle = "#000000";
    ctx.font = "20px Arial";
    ctx.fillText("Test Drawing", 50, 50);
  };

  // Execute drawing when component mounts
  React.useEffect(() => {
    drawOnCanvas();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !canvasRef.current) return;
    
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      // Get the drawing as base64 data
      const canvas = canvasRef.current;
      const imageData = canvas.toDataURL('image/png').split(',')[1];
      
      console.log('Sending image data of length:', imageData.length);
      
      // Call our API endpoint for Gemini image generation
      const response = await fetch('/api/ai/gemini-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          imageData,
          context: 'Test'
        }),
      });
      
      const data = await response.json();
      
      console.log('API response:', {
        success: data.success,
        hasImageData: !!data.imageData,
        imageDataLength: data.imageData ? data.imageData.length : 0,
        message: data.message
      });
      
      if (data.success && data.imageData) {
        const imageUrl = `data:image/png;base64,${data.imageData}`;
        setGeneratedImage(imageUrl);
      } else {
        setErrorMessage(data.error || 'Failed to generate image');
      }
    } catch (error: any) {
      console.error('Error submitting drawing:', error);
      setErrorMessage(error.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Gemini API Direct Test</h1>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Input</h2>
            <canvas 
              ref={canvasRef}
              width={400}
              height={300}
              className="border border-gray-300 mb-4 bg-white"
            />
            
            <button 
              onClick={drawOnCanvas}
              className="bg-blue-500 text-white py-2 px-4 rounded mb-4 hover:bg-blue-600"
            >
              Redraw Test Shape
            </button>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prompt
                </label>
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe how to modify the image..."
                  className="w-full p-2 border border-gray-300 rounded"
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700 transition-colors disabled:bg-gray-400"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <LoaderCircle className="w-5 h-5 animate-spin mr-2" />
                    Processing...
                  </span>
                ) : (
                  'Generate with Gemini'
                )}
              </button>
            </form>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Output</h2>
            {errorMessage && (
              <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4 border border-red-200">
                {errorMessage}
              </div>
            )}
            
            {generatedImage ? (
              <div>
                <img 
                  src={generatedImage} 
                  alt="Generated image" 
                  className="border border-gray-300 rounded mb-2"
                  style={{ maxWidth: '100%' }}
                />
                <p className="text-sm text-gray-500">Generated image is displayed above</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-md h-[300px] flex items-center justify-center bg-gray-50">
                <p className="text-gray-500">Generated image will appear here</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Debug Information</h2>
          <p className="mb-2">
            Check your browser console for detailed API request and response logs.
          </p>
          <p className="text-sm text-gray-600">
            If you're still seeing issues, try:
          </p>
          <ul className="list-disc pl-6 text-sm text-gray-600">
            <li>Verifying your Google API key has access to Gemini Pro Vision</li>
            <li>Checking the network tab for any API request errors</li>
            <li>Trying a different prompt</li>
            <li>Reducing the size or complexity of the test image</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
