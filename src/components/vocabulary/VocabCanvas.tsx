'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GoogleGenAI, ContentUnion, Modality } from '@google/genai';
import { LoaderCircle, SendHorizontal, Trash2, X, Mic, SkipBack, SkipForward } from 'lucide-react';
import { useCanvasStore } from '@/state/canvasStore';
import LiveKitSession from '@/components/LiveKitSession';
import styles from './VocabCanvas.module.css';

// Helper function to parse errors in a more readable format
function parseError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    if (error && typeof error === 'object') {
      const errorString = JSON.stringify(error);
      const regex = /{"error":(.*)}/gm;
      const m = regex.exec(errorString);
      if (m && m[1]) {
        const err = JSON.parse(m[1]);
        return err.message || errorString;
      }
      return errorString;
    }
  } catch (e) {
    // If parsing fails, return the original error as string
  }
  return String(error);
}

interface VocabCanvasProps {
  apiKey?: string;
  vocabularyWord?: string;
  definition?: string;
  className?: string;
  userId?: string;
  wordId?: string;
  roomName?: string;
  onLeave?: () => void;
}

export default function VocabCanvas({
  apiKey,
  vocabularyWord = '',
  definition = '',
  className = '',
  userId = '',
  wordId = '',
  roomName = 'VocabularyPractice',
  onLeave = () => {}
}: VocabCanvasProps) {
  // Canvas and drawing state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#000000');
  const colorInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // UI state
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState(28); // Progress percentage for the progress bar
  
  // Canvas store state for persistent drawing
  const elements = useCanvasStore((state) => state.elements);
  const addElement = useCanvasStore((state) => state.addElement);
  const loadCanvasState = useCanvasStore((state) => state.loadCanvasState);
  const saveCanvasState = useCanvasStore((state) => state.saveCanvasState);
  const handleAIImageCommand = useCanvasStore((state) => state.handleAIImageCommand);

  // Initialize Gemini AI
  const getAI = useCallback(() => {
    const key = apiKey || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    if (!key) {
      throw new Error('Google API Key is required for Gemini image generation');
    }
    return new GoogleGenAI({ apiKey: key });
  }, [apiKey]);
  
  // Load canvas state on initial load
  useEffect(() => {
    if (userId && wordId) {
      loadCanvasState(userId, wordId).catch(err => {
        console.error('Error loading canvas state:', err);
      });
    }
  }, [userId, wordId, loadCanvasState]);
  
  // Auto save canvas state periodically
  useEffect(() => {
    if (!userId || !wordId) return;
    
    const saveInterval = setInterval(() => {
      saveCanvasState(userId, wordId).catch(err => {
        console.error('Error auto-saving canvas state:', err);
      });
    }, 30000); // Save every 30 seconds
    
    return () => clearInterval(saveInterval);
  }, [userId, wordId, saveCanvasState]);

  // Load background image when generatedImage changes
  useEffect(() => {
    if (generatedImage && canvasRef.current) {
      const img = new window.Image();
      img.onload = () => {
        backgroundImageRef.current = img;
        drawImageToCanvas();
      };
      img.onerror = (err) => {
        console.error('Error loading generated image:', err);
        setErrorMessage('Failed to load the generated image. Please try again.');
        setShowErrorModal(true);
      };
      img.src = generatedImage;
    }
  }, [generatedImage]);

  // Initialize canvas with white background when component mounts
  useEffect(() => {
    if (canvasRef.current) {
      initializeCanvas();
    }
  }, []);

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
    ctx.drawImage(
      backgroundImageRef.current,
      0,
      0,
      canvas.width,
      canvas.height,
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
    
    if ('touches' in e) {
      // Touch event
      clientX = e.touches[0]?.clientX || 0;
      clientY = e.touches[0]?.clientY || 0;
    } else {
      // Mouse event
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
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

    // Prevent default behavior to avoid scrolling on touch devices
    if ('touches' in e) {
      e.preventDefault();
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { x, y } = getCoordinates(e);

    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = penColor;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    
    // Optionally save the drawing to the canvas store
    if (canvasRef.current) {
      saveDrawingAsElement();
    }
  };

  const saveDrawingAsElement = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Get the canvas data as an image
    const dataUrl = canvas.toDataURL('image/png');
    
    // Create a new element in the store
    const id = `drawing-${Date.now()}`;
    const drawingData = {
      id,
      type: 'image' as const,
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
      imageUrl: dataUrl,
      rotation: 0,
      opacity: 1,
      metadata: {
        prompt: vocabularyWord ? `Drawing for ${vocabularyWord}` : 'Canvas drawing',
        originalImage: dataUrl,
        generationDate: new Date().toISOString(),
        imageUrl: dataUrl
      }
    };
    
    addElement(drawingData);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill with white instead of just clearing
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    setGeneratedImage(null);
    backgroundImageRef.current = null;
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPenColor(e.target.value);
  };

  const openColorPicker = () => {
    if (colorInputRef.current) {
      colorInputRef.current.click();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      openColorPicker();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canvasRef.current || !prompt.trim()) return;

    setIsLoading(true);

    try {
      // Get the drawing as base64 data
      const canvas = canvasRef.current;

      // Create a temporary canvas to add white background
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (!tempCtx) {
        throw new Error('Failed to create canvas context');
      }

      // Fill with white background
      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      // Draw the original canvas content on top of the white background
      tempCtx.drawImage(canvas, 0, 0);

      const drawingData = tempCanvas.toDataURL('image/png').split(',')[1];

      // Create content for Gemini API request
      let contents: any[] = [{
        role: 'user',
        parts: [{ text: `Create a simple drawing that illustrates "${vocabularyWord}". ${prompt}.` }]
      }];

      if (drawingData) {
        contents = [
          {
            role: 'user',
            parts: [{ inlineData: { data: drawingData, mimeType: 'image/png' } }]
          },
          {
            role: 'user',
            parts: [{ text: `${prompt}. Make it related to the vocabulary word "${vocabularyWord}". Keep the same style.` }]
          },
        ];
      }

      // Call Gemini API
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      let resultImageData: string | null = null;
      let resultMessage: string = '';

      if (response.candidates && response.candidates.length > 0 && response.candidates[0].content) {
        for (const part of response.candidates[0].content.parts || []) {
          if ('text' in part && part.text) {
            resultMessage = part.text;
            console.log('Received text response:', part.text);
          } else if ('inlineData' in part && part.inlineData && part.inlineData.data) {
            resultImageData = part.inlineData.data;
            console.log('Received image data of length:', resultImageData.length);
          }
        }
      } else {
        throw new Error('Invalid response structure from Gemini API');
      }

      if (resultImageData) {
        const imageUrl = `data:image/png;base64,${resultImageData}`;
        setGeneratedImage(imageUrl);
        
        // Also add the generated image to the canvas store for persistence
        const imageId = `ai-image-${Date.now()}`;
        handleAIImageCommand({
          imageId,
          imageUrl,
          width: canvas.width,
          height: canvas.height,
          placementHint: 'center'
        });
      } else {
        throw new Error('No image data received from Gemini API');
      }
    } catch (error) {
      console.error('Error generating with Gemini:', error);
      setErrorMessage(parseError(error));
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Close the error modal
  const closeErrorModal = () => {
    setShowErrorModal(false);
  };
  
  // Function to prevent default touch behavior on canvas
  useEffect(() => {
    const preventTouchDefault = (e: TouchEvent) => {
      if (isDrawing) {
        e.preventDefault();
      }
    };
    
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('touchstart', preventTouchDefault, { passive: false });
      canvas.addEventListener('touchmove', preventTouchDefault, { passive: false });
    }
    
    return () => {
      if (canvas) {
        canvas.removeEventListener('touchstart', preventTouchDefault);
        canvas.removeEventListener('touchmove', preventTouchDefault);
      }
    };
  }, [isDrawing]);

  return (
    <div className={styles.vocabCanvasContainer}>
      <div className={styles.vocabCanvasWrapper}>
        {/* Progress bar removed as requested */}
        
        {/* Title and tools */}
        <div className={styles.canvasTitleInner}>
          <h3 className={styles.canvasHeading}>Drawing Canvas</h3>
          <div className={styles.toolsMenu}>
            <button
              type="button"
              className={styles.colorPickerButton}
              onClick={openColorPicker}
              onKeyDown={handleKeyDown}
              aria-label="Open color picker"
              style={{ backgroundColor: penColor }}>
              <input
                ref={colorInputRef}
                type="color"
                value={penColor}
                onChange={handleColorChange}
                className={styles.hiddenColorInput}
                aria-label="Select pen color"
              />
            </button>
            <button
              type="button"
              onClick={clearCanvas}
              className={styles.toolButton}>
              <Trash2
                className={styles.toolIcon}
                aria-label="Clear Canvas"
              />
            </button>
          </div>
        </div>
        
        {/* Canvas directly under wrapper */}
        <canvas
          ref={canvasRef}
          width={800}
          height={328}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={styles.canvas}
        />
        <div className={styles.scrollbar}>
          <div className={styles.scrollbarThumb}></div>
        </div>

        {/* Prompt input and submit */}
        <form onSubmit={handleSubmit} className={styles.promptForm}>
          <div className={styles.inputContainer}>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Type to generate an image..."
              className={styles.promptInput}
              required
            />
            <button
              type="submit"
              disabled={isLoading}
              className={styles.submitButton}>
              {isLoading ? (
                <LoaderCircle className={styles.loaderIcon} aria-label="Loading" />
              ) : (
                <SendHorizontal className={styles.sendIcon} aria-label="Submit" />
              )}
            </button>
          </div>
        </form>
        
        {/* Control buttons */}
        <div className={styles.controlButtonsContainer}>
          <div className={styles.navigationButtons}>
            <button className={styles.navigationButton}>
              <Mic className={styles.navigationIcon} />
            </button>
            <button className={styles.navigationButton}>
              <SkipBack className={styles.navigationIcon} />
            </button>
            <button className={styles.navigationButton}>
              <SkipForward className={styles.navigationIcon} />
            </button>
          </div>
          
          <button className={styles.primaryButton}>
            Next
          </button>
        </div>
      </div>
      
      {/* LiveKit session buttons centered below canvas */}
      <div className={styles.mediaControlsContainer}>
        <LiveKitSession
          roomName={roomName}
          userName={userId || 'student-user'}
          sessionTitle=""
          pageType="vocab"
          hideVideo={true}
          onLeave={onLeave}
          aiAssistantEnabled={false}
          customControls={<div className="flex gap-2"></div>}
        />
      </div>
      
      {/* AI generated images thumbnails */}
      <div className={styles.sidebarContainer}>
        <div className={styles.imageGallery}>
          {generatedImage && (
            <div className={styles.thumbnail}>
              <img src={generatedImage} alt="User drawing" className={styles.thumbnailImage} />
              <div className={styles.thumbnailLabel}>User</div>
            </div>
          )}
          
          {/* Placeholder image removed */}
        </div>
      </div>
      
      {/* Error Modal */}
      {showErrorModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Failed to generate</h3>
              <button
                onClick={closeErrorModal}
                className={styles.closeButton}>
                <X className={styles.closeIcon} />
              </button>
            </div>
            <p className={styles.modalMessage}>{errorMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}
