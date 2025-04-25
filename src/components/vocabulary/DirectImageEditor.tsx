'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';

interface DirectImageEditorProps {
  imageUrl: string | null;
  onEditComplete: (editedImageData: string, prompt: string) => Promise<void>;
  initialPrompt?: string;
}

const DirectImageEditor: React.FC<DirectImageEditorProps> = ({ 
  imageUrl, 
  onEditComplete,
  initialPrompt = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#000000');
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // We'll use our backend API routes instead of calling Gemini directly

  // Load background image when imageUrl changes
  useEffect(() => {
    if (imageUrl && canvasRef.current) {
      // Use the window.Image constructor
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        backgroundImageRef.current = img;
        drawImageToCanvas();
      };
      img.src = imageUrl;
    } else if (canvasRef.current) {
      // If no image, initialize with white background
      initializeCanvas();
    }
  }, [imageUrl]);

  // Initialize canvas with white background
  const initializeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill canvas with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  // Draw the background image to the canvas
  const drawImageToCanvas = () => {
    if (!canvasRef.current || !backgroundImageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill with white background first
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the background image
    const img = backgroundImageRef.current;
    
    // Calculate proportional sizing to fit the canvas while maintaining aspect ratio
    const scale = Math.min(
      canvas.width / img.width,
      canvas.height / img.height
    );
    
    const centerX = (canvas.width - img.width * scale) / 2;
    const centerY = (canvas.height - img.height * scale) / 2;
    
    ctx.drawImage(
      img,
      centerX,
      centerY,
      img.width * scale,
      img.height * scale
    );
  };

  // Get the correct coordinates based on canvas scaling
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();

    // Calculate the scaling factor between the internal canvas size and displayed size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    
    // Handle both mouse and touch events
    if ('touches' in e) {
      // Touch event
      if (e.touches.length === 0) return { x: 0, y: 0 };
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Apply the scaling to get accurate coordinates
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { x, y } = getCoordinates(e);

    // Prevent default behavior to avoid scrolling on touch devices
    if ('touches' in e) {
      e.preventDefault();
    }

    // Start a new path without clearing the canvas
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { x, y } = getCoordinates(e);

    // Set drawing style
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = penColor;
    
    // Draw the line
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // If there was a background image, redraw it
    if (backgroundImageRef.current) {
      drawImageToCanvas();
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPenColor(e.target.value);
  };

  const openColorPicker = () => {
    colorInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canvasRef.current) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Get the drawing as base64 data
      const canvas = canvasRef.current;
      const drawingData = canvas.toDataURL('image/png').split(',')[1];
      
      console.log('Sending request with prompt:', prompt);
      
      // Use the existing generate-drawing API that we know works
      const response = await fetch('/api/ai/generate-drawing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Updated drawing: ${prompt}. Keep the same minimal line doodle style.`,
          context: prompt
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      // Parse the response
      const data = await response.json();
      
      console.log('API response:', data);
      
      // Process the response - the generate-drawing API returns a different format
      const imageData = data.imageUrl;
      const explanationText = data.explanation || '';
      
      if (imageData) {
        // The imageUrl is already a complete data URL
        await onEditComplete(imageData, prompt);
        console.log('Image updated successfully');
      } else {
        setError('No image was generated. Please try again with a different prompt.');
      }
    } catch (error) {
      console.error('Error editing image:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Add touch event prevention
  useEffect(() => {
    // Function to prevent default touch behavior on canvas
    const preventTouchDefault = (e: TouchEvent) => {
      if (isDrawing) {
        e.preventDefault();
      }
    };

    // Add event listener when component mounts
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('touchstart', preventTouchDefault, {
        passive: false,
      });
      canvas.addEventListener('touchmove', preventTouchDefault, {
        passive: false,
      });
    }

    // Remove event listener when component unmounts
    return () => {
      if (canvas) {
        canvas.removeEventListener('touchstart', preventTouchDefault);
        canvas.removeEventListener('touchmove', preventTouchDefault);
      }
    };
  }, [isDrawing]);

  return (
    <div className="flex flex-col w-full">
      {/* Canvas section */}
      <div className="w-full mb-3 border border-gray-300 rounded-md overflow-hidden">
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing as any}
          onTouchMove={draw as any}
          onTouchEnd={stopDrawing}
          className="w-full h-auto hover:cursor-crosshair bg-white/90 touch-none"
        />
      </div>

      {/* Controls and tools */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center border-2 border-white shadow-sm transition-transform hover:scale-110"
            onClick={openColorPicker}
            aria-label="Open color picker"
            style={{backgroundColor: penColor}}
          >
            <input
              ref={colorInputRef}
              type="color"
              value={penColor}
              onChange={handleColorChange}
              className="opacity-0 absolute w-px h-px"
              aria-label="Select pen color"
            />
          </button>
          <button
            type="button"
            onClick={clearCanvas}
            className="p-2 rounded-md flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <Trash2
              className="w-4 h-4 text-gray-700"
              aria-label="Clear Canvas"
            />
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 text-red-800 p-2 mb-3 text-sm rounded-md">
          {error}
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="w-full">
        <div className="relative">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your changes..."
            className="w-full p-2 pr-12 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all"
            required
          />
          <button
            type="submit"
            disabled={isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <span className="w-5 h-5 block rounded-full border-2 border-white border-t-transparent animate-spin"></span>
            ) : (
              "Update"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DirectImageEditor;
