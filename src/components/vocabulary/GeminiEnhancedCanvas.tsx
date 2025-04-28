'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Line, Rect, Text, Transformer, Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { 
  DrawingElement, 
  useCanvasStore, 
  CanvasStoreState, 
  CanvasStoreActions, 
  ImageElement, 
  TextElement, 
  Viewport, 
  DrawingTool, 
  LineElement, 
  RectangleElement 
} from '@/state/canvasStore'; 
import { v4 as uuidv4 } from 'uuid';
import { LoaderCircle, Sparkles } from 'lucide-react';

// Helper function for base64 encoding/decoding
const canvasToBase64 = (canvas: HTMLCanvasElement): string => {
  // Create a temporary canvas to ensure we have a white background
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  
  if (!tempCtx) return '';
  
  // Fill with white background
  tempCtx.fillStyle = '#FFFFFF';
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  
  // Draw the original canvas content on top
  tempCtx.drawImage(canvas, 0, 0);
  
  // Return as data URL without the prefix
  return tempCanvas.toDataURL('image/png').split(',')[1];
};

interface GeminiEnhancedCanvasProps {
  className?: string;
  vocabularyWord?: string;
}

const GeminiEnhancedCanvas: React.FC<GeminiEnhancedCanvasProps> = ({ 
  className = '',
  vocabularyWord = ''
}) => {

const GeminiEnhancedCanvas: React.FC<GeminiEnhancedCanvasProps> = ({ 
  className = '',
  vocabularyWord = ''
}) => {
  // Use individual selectors with explicit state types
  const elements = useCanvasStore((state: CanvasStoreState & CanvasStoreActions) => state.elements);
  const addElement = useCanvasStore((state: CanvasStoreState & CanvasStoreActions) => state.addElement);
  const updateElement = useCanvasStore((state: CanvasStoreState & CanvasStoreActions) => state.updateElement);
  const currentTool = useCanvasStore((state: CanvasStoreState & CanvasStoreActions) => state.currentTool);
  const selectedIds = useCanvasStore((state: CanvasStoreState & CanvasStoreActions) => state.selectedElementIds);
  const setSelectedIds = useCanvasStore((state: CanvasStoreState & CanvasStoreActions) => state.setSelectedElementIds);
  const viewport = useCanvasStore((state: CanvasStoreState & CanvasStoreActions) => state.viewport);
  const setViewport = useCanvasStore((state: CanvasStoreState & CanvasStoreActions) => state.setViewport);
  const strokeColor = useCanvasStore((state: CanvasStoreState & CanvasStoreActions) => state.toolOptions.strokeColor);
  const strokeWidth = useCanvasStore((state: CanvasStoreState & CanvasStoreActions) => state.toolOptions.strokeWidth);
  const setIsGeneratingAI = useCanvasStore((state: CanvasStoreState & CanvasStoreActions) => state.setIsGeneratingAI);
  const isGeneratingAI = useCanvasStore((state: CanvasStoreState & CanvasStoreActions) => state.isGeneratingAI);

  const [isDrawing, setIsDrawing] = useState(false);
  const [editingText, setEditingText] = useState<{ id: string; text: string } | null>(null);
  
  // States for Gemini functionality - defaulting to Gemini mode on
  const [isInGeminiMode, setIsInGeminiMode] = useState(true);
  const [captureStageForGemini, setCaptureStageForGemini] = useState(false);
  const [geminiPrompt, setGeminiPrompt] = useState('');
  const [geminiError, setGeminiError] = useState<string | null>(null);
  
  const stageRef = useRef<Konva.Stage>(null); 
  const transformerRef = useRef<Konva.Transformer>(null); 
  const promptInputRef = useRef<HTMLInputElement>(null);
  
  const [stageSize, setStageSize] = useState({
    width: window.innerWidth - 200,
    height: window.innerHeight - 180,
  });
  
  // Get stage screenshot as base64 data
  const captureStage = useCallback(() => {
    if (!stageRef.current) return null;
    
    return stageRef.current.toDataURL({ 
      pixelRatio: 2,
      mimeType: 'image/png'
    }).split(',')[1]; // Remove data:image/png;base64, prefix
  }, []);
  
  // Enhanced image generation with Gemini
  const generateWithGemini = useCallback(async (prompt: string) => {
    if (!prompt || !stageRef.current) return;
    
    setIsGeneratingAI(true);
    try {
      // Capture current stage as base64 data
      const imageData = captureStage();
      
      if (!imageData) {
        throw new Error('Failed to capture canvas data');
      }
      
      // Call our API endpoint for Gemini image generation
      const response = await fetch('/api/ai/gemini-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          imageData,
          context: vocabularyWord
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate image');
      }
      
      const data = await response.json();
      
      // Debug the response
      console.log('Gemini API response:', {
        success: data.success,
        hasImageData: !!data.imageData,
        imageDataLength: data.imageData ? data.imageData.length : 0,
        message: data.message
      });
      
      if (data.success && data.imageData) {
        // Add the generated image to the canvas
        const id = `image-${Date.now()}`;
        const imageUrl = `data:image/png;base64,${data.imageData}`;
        
        console.log('Loading image from URL:', imageUrl.substring(0, 30) + '...');
        
        // Create a temporary image element to get the dimensions
        const img = new window.Image();
        
        // Set up proper error handling for image loading
        const imageLoadPromise = new Promise((resolve, reject) => {
          img.onload = () => {
            console.log('Image loaded successfully with dimensions:', img.width, 'x', img.height);
            resolve(true);
          };
          img.onerror = (err) => {
            console.error('Error loading image:', err);
            reject(new Error('Failed to load generated image'));
          };
          img.src = imageUrl;
        });
        
        try {
          await imageLoadPromise;
        
          // Define virtual canvas dimensions - large enough for scrolling
          const canvasWidth = 3000;
          const canvasHeight = 3000;
          const safeLeft = 50;
          const safeTop = 50;
          const safeRight = canvasWidth - 50;
          const safeBottom = canvasHeight - 50;
          
          // Add the image to the canvas with proper dimensions
          // Ensure we have reasonable default dimensions if the image fails to load properly
          const imgWidth = img.width || 400;
          const imgHeight = img.height || 300;
          
          // Calculate optimal placement in the visible canvas area
          const optimalWidth = Math.min(imgWidth, stageSize.width - 100);
          const optimalHeight = Math.min(imgHeight, stageSize.height - 100);
          
          // Center the image in the visible canvas area
          const xPos = (stageSize.width - optimalWidth) / 2;
          const yPos = (stageSize.height - optimalHeight) / 2;
          
          const newImageElement: ImageElement = {
            id: uuidv4(),
            type: 'image' as const,
            x: xPos,
            y: yPos,
            width: optimalWidth,
            height: optimalHeight,
            imageUrl: imageUrl, // Required for ImageElement type
            url: imageUrl, // For backward compatibility
            rotation: 0,
            metadata: {
              prompt: geminiPrompt,
              originalImage: captureStage() || undefined,
              generationDate: new Date().toISOString()
            }
          };
          addElement(newImageElement);
          setSelectedIds(new Set([newImageElement.id]));
        } catch (imgError) {
          console.error('Image loading error:', imgError);
          setGeminiError('Failed to load the generated image. Please try again.');
        }
        
      } else {
        throw new Error('No image data received from API');
      }
    } catch (error: any) {
      console.error('Error generating with Gemini:', error);
      setGeminiError(error.message || 'Failed to generate image');
    } finally {
      setIsGeneratingAI(false);
      setGeminiPrompt('');
    }
  }, [
    addElement, 
    captureStage, 
    setIsGeneratingAI, 
    setSelectedIds, 
    stageSize.height, 
    stageSize.width, 
    vocabularyWord
  ]);
  
  useEffect(() => {
    const updateDimensions = () => {
      // Get the container's dimensions if available, otherwise use window size minus margins
      const containerElement = document.querySelector('.canvas-container');
      if (containerElement) {
        const rect = containerElement.getBoundingClientRect();
        setStageSize({
          width: rect.width - 2, // Subtract border width
          height: rect.height - 2,
        });
      } else {
        // Fallback dimensions if container not found
        setStageSize({
          width: Math.min(window.innerWidth - 80, 1200),
          height: Math.min(window.innerHeight - 240, 800),
        });
      }
    };

    window.addEventListener('resize', updateDimensions);
    // Set initial dimensions after a short delay to ensure container is rendered
    setTimeout(updateDimensions, 100);

    return () => window.removeEventListener('resize', updateDimensions);
  }, []);
  
  const [viewport, setViewport] = useState<Viewport>({
    x: 0,
    y: 0,
    scale: 1,
  });
  
  // Add zoom controls state
  const [showZoomControls, setShowZoomControls] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100); // percentage

  // Update viewport when store changes
  useEffect(() => {
    setViewport(storeViewport);
    setZoomLevel(Math.round(storeViewport.scale * 100));
  }, [storeViewport]);

  // Handle zooming with mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    // Determine if this is a zoom event (with Ctrl/Meta key) or a pan event
    const isZoom = e.ctrlKey || e.metaKey;
    
    if (isZoom) {
      // For zooming
      const scaleBy = 1.1;
      const direction = e.deltaY > 0 ? 1 : -1;
      const newScale = direction > 0 
        ? Math.max(0.1, viewport.scale / scaleBy)
        : Math.min(5, viewport.scale * scaleBy);
      
      setViewport(prev => ({
        ...prev,
        scale: newScale
      }));
      setZoomLevel(Math.round(newScale * 100));
    } else {
      // For panning/scrolling
      setViewport(prev => ({
        ...prev,
        x: prev.x - e.deltaX * 2,
        y: prev.y - e.deltaY * 2
      }));
    }
  }, [viewport]);
  
  // Zoom in function
  const handleZoomIn = useCallback(() => {
    setViewport(prev => {
      const newScale = Math.min(5, prev.scale * 1.1);
      setZoomLevel(Math.round(newScale * 100));
      return {
        ...prev,
        scale: newScale
      };
    });
  }, []);
  
  // Zoom out function
  const handleZoomOut = useCallback(() => {
    setViewport(prev => {
      const newScale = Math.max(0.1, prev.scale / 1.1);
      setZoomLevel(Math.round(newScale * 100));
      return {
        ...prev,
        scale: newScale
      };
    });
  }, []);

}, [addElement, captureStage, setIsGeneratingAI, setSelectedIds, stageSize, vocabularyWord]);

useEffect(() => {
const updateDimensions = () => {
// Get the container's dimensions if available, otherwise use window size minus margins
const containerElement = document.querySelector('.canvas-container');
if (containerElement) {
const rect = containerElement.getBoundingClientRect();
setStageSize({
width: rect.width - 2, // Subtract border width
height: rect.height - 2,
});
} else {
// Fallback dimensions if container not found
setStageSize({
width: Math.min(window.innerWidth - 80, 1200),
height: Math.min(window.innerHeight - 240, 800),
});
}
};

window.addEventListener('resize', updateDimensions);
// Set initial dimensions after a short delay to ensure container is rendered
setTimeout(updateDimensions, 100);

return () => window.removeEventListener('resize', updateDimensions);
}, []);

const [viewport, setViewport] = useState<Viewport>({
x: 0,
y: 0,
scale: 1,
});

// Add zoom controls state
const [showZoomControls, setShowZoomControls] = useState(false);
const [zoomLevel, setZoomLevel] = useState(100); // percentage

// Update viewport when store changes
useEffect(() => {
setViewport(storeViewport);
setZoomLevel(Math.round(storeViewport.scale * 100));
}, [storeViewport]);

// Handle zooming with mouse wheel
const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
e.preventDefault();

// Determine if this is a zoom event (with Ctrl/Meta key) or a pan event
const isZoom = e.ctrlKey || e.metaKey;

if (isZoom) {
// For zooming
const scaleBy = 1.1;
const direction = e.deltaY > 0 ? 1 : -1;
const newScale = direction > 0
? Math.max(0.1, viewport.scale / scaleBy)
: Math.min(5, viewport.scale * scaleBy);

setViewport(prev => ({
...prev,
scale: newScale
}));
setZoomLevel(Math.round(newScale * 100));
} else {
// For panning/scrolling
setViewport(prev => ({
...prev,
x: prev.x - e.deltaX * 2,
y: prev.y - e.deltaY * 2
}));
}
}, [viewport]);

// Zoom in function
const handleZoomIn = useCallback(() => {
setViewport(prev => {
const newScale = Math.min(5, prev.scale * 1.1);
setZoomLevel(Math.round(newScale * 100));
return {
...prev,
scale: newScale
};
});
}, []);

// Zoom out function
const handleZoomOut = useCallback(() => {
setViewport(prev => {
const newScale = Math.max(0.1, prev.scale / 1.1);
setZoomLevel(Math.round(newScale * 100));
return {
...prev,
scale: newScale
};
});
}, []);

// Reset view function
const handleResetView = useCallback(() => {
setViewport({
x: 0,
y: 0,
scale: 1
});
setZoomLevel(100);
}, []);

// Update store when viewport changes in this component
useEffect(() => {
if (
viewport.x !== storeViewport.x ||
viewport.y !== storeViewport.y ||
viewport.scale !== storeViewport.scale
) {
setStoreViewport(viewport);
}
}, [viewport, storeViewport, setStoreViewport]);

useEffect(() => {
if (transformerRef.current && selectedIds.size > 0) {
const stage = stageRef.current;
if (!stage) return;

const nodes = Array.from(selectedIds).map(id => {
return stage.findOne(`#${id}`) ?? null;
}).filter((node): node is Konva.Node => node !== null);

transformerRef.current.nodes(nodes);
transformerRef.current.getLayer()?.batchDraw();
} else if (transformerRef.current) {
transformerRef.current.nodes([]);
transformerRef.current.getLayer()?.batchDraw();
}
}, [selectedIds]);

// Handle Gemini prompt submission when Enter is pressed
const handleGeminiPromptKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
if (e.key === 'Enter' && geminiPrompt.trim() && !isGeneratingAI) {
generateWithGemini(geminiPrompt.trim());
}
};

const handleGeminiModeToggle = () => {
// Toggle Gemini mode
setIsInGeminiMode(!isInGeminiMode);

// If turning on Gemini mode, focus the prompt input
if (!isInGeminiMode) {
setTimeout(() => {
if (promptInputRef.current) {
promptInputRef.current.focus();
}
}, 100);
}
};

// Rest of the canvas functionality (unchanged from SimpleCanvas)
const handleElementClick = useCallback((id: string) => {
setSelectedIds(new Set([id]));
}, [setSelectedIds]);

const handleElementDragEnd = useCallback((id: string, e: KonvaEventObject<DragEvent>) => {
const element = elements.get(id);
if (!element) return;

const newPos = e.target.position();

updateElement(id, {
x: newPos.x,
y: newPos.y
});
}, [elements, updateElement]);

const handleTransformEnd = useCallback((id: string, e: KonvaEventObject<Event>) => {
const element = elements.get(id);
if (!element) return;

const node = e.target;
const scaleX = node.scaleX();
const scaleY = node.scaleY();

// Reset scale to 1 and update width and height
node.scaleX(1);
node.scaleY(1);

// For images and rectangles
if (element.type === 'image' || element.type === 'rectangle') {
updateElement(id, {
width: element.width * scaleX,
height: element.height * scaleY,
rotation: node.rotation()
});
}

// For text elements
if (element.type === 'text') {
const textElement = element as TextElement;
updateElement(id, {
width: (textElement.width || 0) * scaleX,
height: (textElement.height || 0) * scaleY,
rotation: node.rotation(),
fontSize: textElement.fontSize * Math.min(scaleX, scaleY) // Scale font size proportionally
});
}
}, [elements, updateElement]);

const handleStageMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
// Check for clicks on the stage
const clickedOnEmpty = e.target === e.target.getStage();

// Only proceed if click is on the stage and not on another element
if (clickedOnEmpty && currentTool !== 'select') {
setSelectedIds(new Set()); // Clear selection

if (currentTool === 'pencil') {
// Start drawing line
setIsDrawing(true);

const pos = e.target.getStage()?.getPointerPosition();
if (!pos) return;

// Create new line
const id = uuidv4();
const line: LineElement = {
id,
type: 'line',
x: 0,
y: 0,
points: [pos.x, pos.y],
stroke: strokeColor,
strokeWidth: strokeWidth
};

addElement(line);
} else if (currentTool === 'rectangle') {
// Start drawing rectangle
const pos = e.target.getStage()?.getPointerPosition();
if (!pos) return;

const id = uuidv4();
const rect: RectangleElement = {
id,
type: 'rectangle',
x: pos.x,
y: pos.y,
width: 0,
height: 0,
stroke: strokeColor,
strokeWidth: strokeWidth,
fill: '',
};

addElement(rect);
setSelectedIds(new Set([id]));
} else if (currentTool === 'text') {
const pos = e.target.getStage()?.getPointerPosition();
if (!pos) return;

const id = uuidv4();
const textElement: TextElement = {
id,
type: 'text',
x: pos.x,
y: pos.y,
text: 'Double-click to edit',
fontSize: 16,
fontFamily: 'Arial',
fill: strokeColor,
width: 200,
height: 24,
align: 'left'
};

addElement(textElement);
setSelectedIds(new Set([id]));
}
} else if (clickedOnEmpty) {
// If in select mode and clicked on empty stage, clear selection
setSelectedIds(new Set());
}
}, [addElement, currentTool, setSelectedIds, strokeColor, strokeWidth]);

const handleStageMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
if (!isDrawing) return;

const stage = e.target.getStage();
const pos = stage?.getPointerPosition();
if (!pos) return;

// Find the last line drawn
const lastId = Array.from(elements.keys()).pop();
if (lastId) {
const lastElement = elements.get(lastId);

if (lastElement?.type === 'line') {
// Add new point to the line
const newPoints = [...lastElement.points, pos.x, pos.y];

updateElement(lastId, {
points: newPoints
});
} else if (lastElement?.type === 'rectangle' && currentTool === 'rectangle') {
const oldX = lastElement.x;
const oldY = lastElement.y;
const newWidth = pos.x - oldX;
const newHeight = pos.y - oldY;

updateElement(lastId, {
width: newWidth,
height: newHeight,
});
}
}
}, [currentTool, elements, isDrawing, updateElement]);

const handleStageMouseUp = useCallback(() => {
setIsDrawing(false);
      
      const nodes = Array.from(selectedIds).map(id => {
        return stage.findOne(`#${id}`) ?? null;
      }).filter((node): node is Konva.Node => node !== null); 
      
      transformerRef.current.nodes(nodes);
      transformerRef.current.getLayer()?.batchDraw();
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedIds]);
  
  // Handle Gemini prompt submission when Enter is pressed
  const handleGeminiPromptKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && geminiPrompt.trim() && !isGeneratingAI) {
      generateWithGemini(geminiPrompt.trim());
    }
  };
  
  const handleGeminiModeToggle = () => {
    // Toggle Gemini mode
    setIsInGeminiMode(!isInGeminiMode);
    
    // If turning on Gemini mode, focus the prompt input
    if (!isInGeminiMode) {
      setTimeout(() => {
        if (promptInputRef.current) {
          promptInputRef.current.focus();
        }
      }, 100);
    }
  };
  
  // Rest of the canvas functionality (unchanged from SimpleCanvas)
  const handleElementClick = useCallback((id: string) => {
    setSelectedIds(new Set([id]));
  }, [setSelectedIds]);
  
  const handleElementDragEnd = useCallback((id: string, e: KonvaEventObject<DragEvent>) => {
    const element = elements.get(id);
    if (!element) return;
    
    const newPos = e.target.position();
    
    updateElement(id, {
      x: newPos.x,
      y: newPos.y
    });
  }, [elements, updateElement]);
  
  const handleTransformEnd = useCallback((id: string, e: KonvaEventObject<Event>) => {
    const element = elements.get(id);
    if (!element) return;
    
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    
    // Reset scale to 1 and update width and height
    node.scaleX(1);
    node.scaleY(1);
    
    // For images and rectangles
    if (element.type === 'image' || element.type === 'rectangle') {
      updateElement(id, {
        width: element.width * scaleX,
        height: element.height * scaleY,
        rotation: node.rotation()
      });
    }
    
    // For text elements
    if (element.type === 'text') {
      const textElement = element as TextElement;
      updateElement(id, {
        width: (textElement.width || 0) * scaleX,
        height: (textElement.height || 0) * scaleY,
        rotation: node.rotation(),
        fontSize: textElement.fontSize * Math.min(scaleX, scaleY) // Scale font size proportionally
      });
    }
  }, [elements, updateElement]);
  
  const handleStageMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    // Check for clicks on the stage
    const clickedOnEmpty = e.target === e.target.getStage();
    
    // Only proceed if click is on the stage and not on another element
    if (clickedOnEmpty && currentTool !== 'select') {
      setSelectedIds(new Set()); // Clear selection
      
      if (currentTool === 'pencil') {
        // Start drawing line
        setIsDrawing(true);
        
        const pos = e.target.getStage()?.getPointerPosition();
        if (!pos) return;
        
        // Create new line
        const id = uuidv4();
        const line: LineElement = {
          id,
          type: 'line',
          x: 0,
          y: 0,
          points: [pos.x, pos.y],
          stroke: strokeColor,
          strokeWidth: strokeWidth
        };
        
        addElement(line);
      } else if (currentTool === 'rectangle') {
        // Start drawing rectangle
        const pos = e.target.getStage()?.getPointerPosition();
        if (!pos) return;
        
        const id = uuidv4();
        const rect: RectangleElement = {
          id,
          type: 'rectangle',
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          fill: '',
        };
        
        addElement(rect);
        setSelectedIds(new Set([id]));
      } else if (currentTool === 'text') {
        const pos = e.target.getStage()?.getPointerPosition();
        if (!pos) return;
        
        const id = uuidv4();
        const textElement: TextElement = {
          id,
          type: 'text',
          x: pos.x,
          y: pos.y,
          text: 'Double-click to edit',
          fontSize: 16,
          fontFamily: 'Arial',
          fill: strokeColor,
          width: 200,
          height: 24,
          align: 'left'
        };
        
        addElement(textElement);
        setSelectedIds(new Set([id]));
      }
    } else if (clickedOnEmpty) {
      // If in select mode and clicked on empty stage, clear selection
      setSelectedIds(new Set());
    }
  }, [addElement, currentTool, setSelectedIds, strokeColor, strokeWidth]);
  
  const handleStageMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (!isDrawing) return;
    
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    
    // Find the last line drawn
    const lastId = Array.from(elements.keys()).pop();
    if (lastId) {
      const lastElement = elements.get(lastId);
      
      if (lastElement?.type === 'line') {
        // Add new point to the line
        const newPoints = [...lastElement.points, pos.x, pos.y];
        
        updateElement(lastId, {
          points: newPoints
        });
      } else if (lastElement?.type === 'rectangle' && currentTool === 'rectangle') {
        const oldX = lastElement.x;
        const oldY = lastElement.y;
        const newWidth = pos.x - oldX;
        const newHeight = pos.y - oldY;
        
        updateElement(lastId, {
          width: newWidth,
          height: newHeight,
        });
      }
    }
  }, [currentTool, elements, isDrawing, updateElement]);
  
  const handleStageMouseUp = useCallback(() => {
    setIsDrawing(false);
  }, []);
  
  const handleTextDblClick = useCallback((id: string, text: string) => {
    setEditingText({ id, text });
    
    // Need to attach a textarea for editing
    const textNode = stageRef.current?.findOne(`#${id}`);
    if (textNode) {
      const textPosition = textNode.getAbsolutePosition();
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      
      textarea.value = text;
      textarea.style.position = 'absolute';
      textarea.style.top = `${textPosition.y}px`;
      textarea.style.left = `${textPosition.x}px`;
      textarea.style.width = `${(textNode as any).width()}px`;
      textarea.style.height = `${(textNode as any).height()}px`;
      textarea.style.fontSize = `${(textNode as any).fontSize()}px`;
      textarea.style.border = 'none';
      textarea.style.padding = '0px';
      textarea.style.margin = '0px';
      textarea.style.overflow = 'hidden';
      textarea.style.background = 'none';
      textarea.style.outline = 'none';
      textarea.style.resize = 'none';
      textarea.style.lineHeight = (textNode as any).lineHeight() || 1;
      textarea.style.fontFamily = (textNode as any).fontFamily();
      textarea.style.transformOrigin = 'left top';
      textarea.style.textAlign = (textNode as any).align();
      textarea.style.color = (textNode as any).fill();
      
      setTimeout(() => {
        textarea.focus();
      });
      
      const handleOutsideClick = (e: MouseEvent) => {
        if (e.target !== textarea) {
          const newText = textarea.value;
          document.body.removeChild(textarea);
          window.removeEventListener('click', handleOutsideClick);
          
          if (newText !== text) {
            updateElement(id, { text: newText });
          }
          setEditingText(null);
        }
      };
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          const newText = textarea.value;
          document.body.removeChild(textarea);
          window.removeEventListener('click', handleOutsideClick);
          window.removeEventListener('keydown', handleKeyDown);
          
          if (newText !== text) {
            updateElement(id, { text: newText });
          }
          setEditingText(null);
        }
      };
      
      textarea.addEventListener('keydown', handleKeyDown);
      window.addEventListener('click', handleOutsideClick);
    }
  }, [updateElement]);
  
  return (
    <div className={`relative ${className}`} style={{ minHeight: 700, overflow: 'hidden' }}>
      {/* Canvas for drawing with infinite scrollable area */}
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        onMouseDown={handleStageMouseDown}
        onMousemove={handleStageMouseMove}
        onMouseup={handleStageMouseUp}
        className="bg-white border border-gray-300"
        style={{ 
          cursor: currentTool === 'select' ? 'default' : 'crosshair',
        }}
        offsetY={-viewport.y} // Apply vertical scrolling offset
        scaleX={viewport.scale}
        scaleY={viewport.scale}
      >
        <Layer>
          {/* Draw all elements */}
          {Array.from(elements.values()).map(element => {
            // Line element
            if (element.type === 'line') {
              return (
                <Line
                  key={element.id}
                  id={element.id}
                  points={element.points}
                  stroke={element.stroke}
                  strokeWidth={element.strokeWidth}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  draggable={currentTool === 'select'}
                  onClick={() => handleElementClick(element.id)}
                  onDragEnd={(e) => handleElementDragEnd(element.id, e)}
                  onTransformEnd={(e) => handleTransformEnd(element.id, e)}
                />
              );
            }
            // Rectangle element
            else if (element.type === 'rectangle') {
              return (
                <Rect
                  key={element.id}
                  id={element.id}
                  x={element.x}
                  y={element.y}
                  width={element.width}
                  height={element.height}
                  stroke={element.stroke}
                  strokeWidth={element.strokeWidth}
                  fill={element.fill}
                  draggable={currentTool === 'select'}
                  onClick={() => handleElementClick(element.id)}
                  onDragEnd={(e) => handleElementDragEnd(element.id, e)}
                  onTransformEnd={(e) => handleTransformEnd(element.id, e)}
                />
              );
            }
            // Text element
            else if (element.type === 'text') {
              const textElement = element as TextElement;
              return (
                <Text
                  key={element.id}
                  id={element.id}
                  x={element.x}
                  y={element.y}
                  text={textElement.text}
                  fontSize={textElement.fontSize}
                  fontFamily={textElement.fontFamily}
                  fill={textElement.fill}
                  width={textElement.width}
                  height={textElement.height}
                  align={textElement.align}
                  draggable={currentTool === 'select'}
                  onClick={() => handleElementClick(element.id)}
                  onDblClick={() => handleTextDblClick(element.id, textElement.text)}
                  onDragEnd={(e) => handleElementDragEnd(element.id, e)}
                  onTransformEnd={(e) => handleTransformEnd(element.id, e)}
                />
              );
            }
            // Image element
            else if (element.type === 'image') {
              const imageElement = element as ImageElement;
              return (
                <KonvaImage
                  key={element.id}
                  id={element.id}
                  x={element.x}
                  y={element.y}
                  width={element.width}
                  height={element.height}
                  image={new window.Image()} // Must provide an initial image
                  draggable={currentTool === 'select'}
                  onClick={() => handleElementClick(element.id)}
                  onDragEnd={(e) => handleElementDragEnd(element.id, e)}
                  onTransformEnd={(e) => handleTransformEnd(element.id, e)}
                  ref={(node) => {
                    if (!node) return;
                    
                    // Access the full element and type-check it
                    const imageElement = element as any;
                    const url = imageElement.url || '';
                    
                    // Skip if no URL (avoids unnecessary errors)
                    if (!url) return;
                    
                    // Create and load the image
                    const img = new window.Image();
                    img.crossOrigin = 'Anonymous';
                    
                    // Set up event handlers before setting src
                    img.onerror = () => {
                      console.warn(`Failed to load image for element ${element.id}`);
                      
                      // Try to load from a data URL if it appears to be one
                      if (url.startsWith('data:')) {
                        // It's already a data URL, nothing more we can do but log it
                        console.error('Image failed to load even though it is a data URL', { id: element.id });
                      } else {
                        // If it's not a data URL, try to load a fallback
                        console.log('Attempting to load fallback image');
                        setTimeout(() => {
                          // Try again after a short delay
                          img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
                        }, 500);
                      }
                    };
                    
                    // Set the source to trigger the load
                    img.src = url;
                    
                    // Add a load handler to confirm success
                    img.onload = () => {
                      // When the image loads, apply it to the Konva node and redraw
                      if (node) {
                        node.image(img);
                        node.getLayer()?.batchDraw();
                        console.log('Successfully loaded image for element:', element.id);
                      }
                    };
                  }}
                />
              );
            }
          })}
          
          {/* Transformer for resizing and rotating elements */}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              // Minimum size of 10x10
              if (newBox.width < 10 || newBox.height < 10) {
                return oldBox;
              }
              return newBox;
            }}
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
            rotateEnabled={true}
            rotationSnaps={[0, 90, 180, 270]}
            anchorSize={10}
            borderDash={[6, 2]}
          />
        </Layer>
      </Stage>
      
      {/* Enhanced scroll controls */}
      <div className="absolute bottom-2 right-2 z-10 flex space-x-2 bg-white p-2 rounded shadow">
        <div className="flex flex-col space-y-1 mr-1">
          <button
            className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
            onClick={() => {
              // Scroll up
              setViewport({
                ...viewport,
                y: viewport.y + 100 // Move up more
              });
            }}
          >
            ↑
          </button>
          <button
            className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
            onClick={() => {
              // Scroll down
              setViewport({
                ...viewport,
                y: viewport.y - 100 // Move down more
              });
            }}
          >
            ↓
          </button>
        </div>
        <div className="flex flex-col space-y-1">
          <button
            className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
            onClick={() => {
              // Scroll left
              setViewport({
                ...viewport,
                x: viewport.x + 100 // Move left more
              });
            }}
          >
            ←
          </button>
          <button
            className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
            onClick={() => {
              // Scroll right
              setViewport({
                ...viewport,
                x: viewport.x - 100 // Move right more
              });
            }}
          >
            →
          </button>
        </div>
        <div className="flex flex-col space-y-1 ml-1">
          <button
            className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
            onClick={() => setViewport({ ...viewport, scale: viewport.scale * 1.2 })}
          >
            +
          </button>
          <button
            className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
            onClick={() => setViewport({ ...viewport, scale: viewport.scale / 1.2 })}
          >
            -
          </button>
        </div>
        <button
          className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 self-center"
          onClick={() => setViewport({ x: 0, y: 0, scale: 1 })}
        >
          Reset
        </button>
      </div>
      
      {/* Scroll indicators */}
      <div className="absolute top-2 left-2 z-10 bg-white/80 p-1 rounded text-xs text-gray-500">
        Position: ({Math.round(viewport.x)}, {Math.round(viewport.y)}) · Zoom: {viewport.scale.toFixed(1)}x
      </div>
      
      {/* Gemini mode toggle button */}
      <div className="absolute top-2 right-2 z-10">
        <button 
          className={`flex items-center space-x-1 px-3 py-2 rounded-md transition-colors ${
            isInGeminiMode
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-100'
          }`}
          onClick={handleGeminiModeToggle}
        >
          <Sparkles size={16} />
          <span>{isInGeminiMode ? 'Exit Gemini Mode' : 'Enhance with Gemini'}</span>
        </button>
      </div>
      
      {/* Gemini prompt input */}
      {isInGeminiMode && (
        <div className="absolute bottom-2 left-2 right-16 z-10">
          <div className="relative">
            <input
              ref={promptInputRef}
              type="text"
              className="w-full px-4 py-2 pr-12 bg-white border border-gray-300 rounded-md shadow focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
              placeholder={`Describe how to enhance your drawing${vocabularyWord ? ` for "${vocabularyWord}"` : ''}`}
              value={geminiPrompt}
              onChange={(e) => setGeminiPrompt(e.target.value)}
              onKeyDown={handleGeminiPromptKeyDown}
              disabled={isGeneratingAI}
            />
            <button 
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-indigo-600 hover:text-indigo-800 disabled:text-gray-400"
              onClick={() => generateWithGemini(geminiPrompt)}
              disabled={!geminiPrompt.trim() || isGeneratingAI}
            >
              {isGeneratingAI ? (
                <LoaderCircle className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      )}
      
      {/* Error Modal */}
      {geminiError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-700">Image Generation Error</h3>
              <button
                onClick={() => setGeminiError(null)}
                className="text-gray-400 hover:text-gray-500 rounded-full p-1 hover:bg-gray-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <p className="font-medium text-gray-600">{geminiError}</p>
          </div>
        </div>
      )}
      
      {/* Loading Indicator for AI Generation */}
      {isGeneratingAI && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-700 font-medium">Gemini is enhancing your drawing...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeminiEnhancedCanvas;
