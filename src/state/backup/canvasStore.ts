import { create } from 'zustand';
import { useState, useEffect } from 'react';

// Assume shared types are available via path alias configured in tsconfig/vite
// import type { DrawingElement, CanvasState } from '@shared/drawing';

// Placeholder Types (if @shared/drawing isn't set up yet)
// Replace these with imports from @shared/drawing once available
export interface BaseElement {
  id: string;
  x: number;
  y: number;
  rotation?: number;
  opacity?: number;
}

export interface LineElement extends BaseElement {
  type: 'line' | 'pencil';
  points: number[];
  stroke: string;
  strokeWidth: number;
}

export interface RectangleElement extends BaseElement {
  type: 'rectangle';
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
  fill?: string;
  rotation?: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontSize: number;
  fill: string;
  rotation?: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  imageUrl: string;
  width: number;
  height: number;
  rotation?: number;
  metadata?: {
    prompt?: string;
    originalImage?: string;
    generationDate?: string;
  };
}

// Union type for all possible elements
export type DrawingElement =
  | LineElement
  | RectangleElement
  | TextElement
  | ImageElement;

export type DrawingTool = 'select' | 'pencil' | 'rectangle' | 'text' | 'pan' | 'image';

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

// Define the state structure for the canvas
export interface CanvasStoreState {
  elements: Map<string, DrawingElement>;
  viewport: Viewport;
  currentTool: DrawingTool;
  toolOptions: { strokeColor: string; strokeWidth: number; fill: string };
  selectedElementIds: Set<string>;
  isDrawing: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isGeneratingAI: boolean;
}

// Define the actions that can modify the state
export interface CanvasStoreActions {
  // Element Management
  setElements: (elements: Map<string, DrawingElement>) => void;
  addElement: (element: DrawingElement) => void;
  updateElement: (id: string, updates: Partial<DrawingElement>) => void;
  deleteElements: (ids: string[]) => void;

  // Viewport Management
  setViewport: (viewport: Viewport) => void;
  updateViewport: (updates: Partial<Viewport>) => void;

  // Tool Management
  setCurrentTool: (tool: DrawingTool) => void;
  setToolOptions: (options: Partial<CanvasStoreState['toolOptions']>) => void;

  // Selection Management
  setSelectedElementIds: (ids: Set<string>) => void;

  // Interaction State
  setIsDrawing: (isDrawing: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  setIsSaving: (isSaving: boolean) => void;
  setIsGeneratingAI: (isGeneratingAI: boolean) => void;

  // --- Backend Interaction Actions ---
  // These will be called by the VocabPage or other logic
  loadCanvasState: (userId: string, wordId: string) => Promise<void>;
  saveCanvasState: (userId: string, wordId: string) => Promise<void>;

  // --- AI Interaction Placeholder Action ---
  // This action will be triggered when the backend sends an AI image command
  // It will eventually contain the non-destructive placement logic
  handleAIImageCommand: (payload: { imageId: string; imageUrl: string; width: number; height: number; placementHint?: string }) => void;
}

// Define the store creation function
export const useCanvasStore = create<CanvasStoreState & CanvasStoreActions>((set, get) => ({
  // Initial State Values
  elements: new Map(),
  viewport: { x: 0, y: 0, scale: 1 },
  currentTool: 'select',
  toolOptions: { strokeColor: '#000000', strokeWidth: 2, fill: 'transparent' },
  selectedElementIds: new Set(),
  isDrawing: false,
  isLoading: false,
  isSaving: false,
  isGeneratingAI: false,

  // Action Implementations
  setElements: (elements: Map<string, DrawingElement>) => set({ elements }),

  addElement: (element: DrawingElement) => set((state: CanvasStoreState) => {
    const newElements = new Map(state.elements);
    newElements.set(element.id, element);
    return { elements: newElements };
  }),

  updateElement: (id: string, updates: Partial<DrawingElement>) => set((state: CanvasStoreState) => {
    const newElements = new Map(state.elements);
    const currentElement = newElements.get(id);
    if (currentElement) {
      // Explicitly cast the merged object back to DrawingElement
      newElements.set(id, { ...currentElement, ...updates } as DrawingElement);
      return { elements: newElements };
    }
    return {}; // No change if element not found
  }),

  deleteElements: (ids: string[]) => set((state: CanvasStoreState) => {
    const newElements = new Map(state.elements);
    let changed = false;
    ids.forEach(id => {
      if (newElements.delete(id)) {
        changed = true;
      }
    });
    if (!changed) return {}; // No change if elements not found

    // Also remove deleted elements from selection
    const newSelectedIds = new Set(Array.from(state.selectedElementIds).filter(id => !ids.includes(id)));
    return { elements: newElements, selectedElementIds: newSelectedIds };
  }),

  setViewport: (viewport: Viewport) => set({ viewport }),
  updateViewport: (updates: Partial<Viewport>) => set((state: CanvasStoreState) => ({ viewport: { ...state.viewport, ...updates } })),

  setCurrentTool: (currentTool: DrawingTool) => set({ currentTool, selectedElementIds: new Set() }), // Clear selection on tool change
  setToolOptions: (toolOptions: Partial<CanvasStoreState['toolOptions']>) => set((state: CanvasStoreState) => ({ toolOptions: { ...state.toolOptions, ...toolOptions } })),

  setSelectedElementIds: (selectedElementIds: Set<string>) => set({ selectedElementIds }),

  setIsDrawing: (isDrawing: boolean) => set({ isDrawing }),
  setIsLoading: (isLoading: boolean) => set({ isLoading }),
  setIsSaving: (isSaving: boolean) => set({ isSaving }),
  setIsGeneratingAI: (isGeneratingAI: boolean) => set({ isGeneratingAI }),

  // --- Backend Interaction Implementations ---
  // Load canvas state from backend or fallback to localStorage
  loadCanvasState: async (userId: string, wordId: string) => {
    if (!userId || !wordId) {
      console.error('Cannot load canvas state: missing userId or wordId');
      return;
    }

    set({ isLoading: true });

    try {
      console.log(`Loading canvas state for user: ${userId}, word: ${wordId}`);
      
      // Attempt to load from backend API
      try {
        const response = await fetch(`/api/user/${userId}/word/${wordId}/canvas`);
        
        // Check if the request was successful
        if (response.ok) {
          const data = await response.json();
          const elementsMap = new Map();
          
          // Convert array back to Map
          data.forEach((element: DrawingElement) => {
            elementsMap.set(element.id, element);
          });
          
          set({ elements: elementsMap });
          console.log(`Loaded canvas from backend API for ${userId}, ${wordId}`);
          return;
        }
        
        // If fetch fails with 404 or other error, continue to localStorage fallback
        throw new Error('API unavailable or canvas not found, using localStorage fallback');
      } catch (apiError) {
        console.warn('API request failed:', apiError);
        // API request failed, try localStorage as fallback
        const localStorageKey = `canvas_${userId}_${wordId}`;
        const storedData = localStorage.getItem(localStorageKey);
        
        if (storedData) {
          try {
            const parsedData = JSON.parse(storedData);
            const elementsMap = new Map();
            
            // Ensure parsedData is an array before using forEach
            if (Array.isArray(parsedData)) {
              // Convert array back to Map
              parsedData.forEach((element: DrawingElement) => {
                elementsMap.set(element.id, element);
              });
            } else {
              console.warn('Stored canvas data is not an array, using empty canvas');
            }
            
            set({ elements: elementsMap });
            console.log(`Loaded canvas from localStorage for ${userId}, ${wordId}`);
            return;
          } catch (parseError) {
            console.error('Error parsing stored canvas data:', parseError);
          }
        }
        
        // If both API and localStorage fail, start with an empty canvas
        console.log(`No saved state found for user ${userId}, word ${wordId} on server. Starting fresh.`);
        set({ elements: new Map() });
      }
    } catch (error) {
      console.error('Error loading canvas state:', error);
      // Could add user-facing error notification here
    } finally {
      set({ isLoading: false });
    }
  },

  saveCanvasState: async (userId: string, wordId: string) => {
    if (!userId || !wordId) {
      console.error('Cannot save canvas state: missing userId or wordId');
      return;
    }
    
    set({ isSaving: true });
    
    try {
      console.log(`Saving canvas state for user: ${userId}, word: ${wordId}`);
      
      // Import storage utilities dynamically to avoid SSR issues
      const { optimizeCanvasDataForStorage, safeLocalStorage } = await import('@/utils/storageUtils');
      
      // Convert elements Map to array for storage
      const canvasData = Array.from(get().elements.values());
      
      // Optimize the canvas data by compressing large images
      const optimizedData = optimizeCanvasDataForStorage(canvasData);
      
      // Save to localStorage with safety checks
      try {
        const success = safeLocalStorage(`canvas_${userId}_${wordId}`, JSON.stringify(optimizedData));
        if (!success) {
          console.warn('Local storage capacity may be reached, saving via API only');
      }
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
    
    // Attempt to save to backend if in production or if API exists
    try {
      // Check if we're in development and if we should skip API calls
      const skipApiInDev = process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_ENABLE_DEV_API;
      
      if (skipApiInDev) {
        console.log('Skipping API call in development. Using localStorage only.');
      } else {
        // Format API endpoint
        const apiUrl = `/api/canvas/save?userId=${encodeURIComponent(userId)}&wordId=${encodeURIComponent(wordId)}`;
        
        // Make API call with a timeout to prevent hanging if API is down
        console.log('Attempting to save canvas state to API endpoint:', apiUrl);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        try {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(optimizedData),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`Failed to save canvas state: ${response.status} ${response.statusText}`);
          }
          
          // All done
          console.log('Canvas state saved successfully to API');
        } catch (fetchError: any) {
          if (fetchError.name === 'AbortError') {
            console.warn('API call timed out, using localStorage only');
          } else if (fetchError.message?.includes('404')) {
            console.warn('API endpoint not found, using localStorage only');
          } else {
            console.error('API error:', fetchError);
          }
          // Exit without throwing since localStorage save succeeded
          return;
        }
      }
    } catch (error) {
      console.error("Error saving canvas state:", error);
      // Properly type error and check for 404
      const typedError = error as Error;
      // Only show user-facing error if it's not just a missing API in development
      if (!(process.env.NODE_ENV === 'development' && typedError.message?.includes('404'))) {
        // Could add user-facing error notification here
      }
    } finally {
      set({ isSaving: false });
    }
  },

  // --- AI Interaction for Image Placement ---
  handleAIImageCommand: (payload: { imageId: string; imageUrl: string; width: number; height: number; placementHint?: string }) => {
    console.log("Received ADD_IMAGE_ELEMENT command, processing:", payload);
    set({ isGeneratingAI: true }); // Show loading while we place it

    // --- Improved Centered Placement Logic ---
    const state = get();
    const newImageId = payload.imageId || `ai-img-${Date.now()}`; // Use provided ID or generate one

    // Get the canvas dimensions from the DOM if possible
    let canvasWidth = 800; // Default fallback width
    let canvasHeight = 600; // Default fallback height
    
    // Try to get actual canvas dimensions - this must be accurate
    const canvasElement = document.querySelector('.konvajs-content');
    if (canvasElement) {
      canvasWidth = canvasElement.clientWidth;
      canvasHeight = canvasElement.clientHeight;
      console.log('Canvas dimensions:', { canvasWidth, canvasHeight });
    }
    
    // Calculate the absolute center of the visible area
    // This is the key to precise positioning
    const viewport = state.viewport;
    
    // For debugging - log the viewport state
    console.log('Current viewport state:', { 
      x: viewport.x, 
      y: viewport.y, 
      scale: viewport.scale 
    });
    
    // Calculate the center in scene coordinates
    // The key formula: (canvas_center_in_pixels - viewport_offset) / scale = scene_coordinates
    const centerX = (canvasWidth / 2 - viewport.x) / viewport.scale;
    const centerY = (canvasHeight / 2 - viewport.y) / viewport.scale;
    
    console.log('Absolute center position:', { centerX, centerY });
    
    // Center the image around the calculated position
    const finalX = centerX - (payload.width / 2);
    const finalY = centerY - (payload.height / 2);

    // --- NEW: Shift existing images upward to make room for the new image ---
    // Create a new Map for elements
    const newElements = new Map(state.elements);
    
    // Identify and shift existing image elements
    let imageCount = 0;
    newElements.forEach((element: unknown) => {
      // Check if this is an element with a type property
      if (typeof element === 'object' && element !== null && 'type' in element) {
        // Now TypeScript knows element has a 'type' property
        const typedElement = element as { type: string; id: string };
        
        // Check if this is an image element
        if (typedElement.type === 'image') {
          // Now that we've verified it's an image, cast to ImageElement
          const imageElement = element as ImageElement;
          
          // Shift this image upward
          const verticalShift = payload.height + 50; // 50px padding between images
          
          // Update the element in the map
          newElements.set(imageElement.id, {
            ...imageElement,
            y: imageElement.y - verticalShift // Move upward
          });
          
          // Increment our counter
          imageCount++;
        }
      }
    });
    
    // If we shifted any images, update the state
    if (imageCount > 0) {
      console.log(`Shifted ${imageCount} existing images upward`);
      // Update the elements in the state
      set({ elements: newElements });
    }
    // --- End of shifting logic ---

    const newImageElement: ImageElement = {
      id: newImageId,
      type: 'image',
      x: finalX,
      y: finalY,
      width: payload.width,
      height: payload.height,
      imageUrl: payload.imageUrl,
      rotation: 0,
      opacity: 1,
    };

    // Add the new element using the existing action
    get().addElement(newImageElement);
    
    // Auto-scroll to show the newly added image
    // Don't update viewport position - just stay focused on current view
    // This ensures the image appears exactly where it should without jumping
    
    // Wait a few frames to ensure the image is added before scrolling to it
    setTimeout(() => {
      // Make sure it's in the viewport if it's outside view
      const viewportWidth = canvasWidth / state.viewport.scale;
      const viewportHeight = canvasHeight / state.viewport.scale;
      
      // Check if the image is outside the current viewport
      const isXOutsideView = finalX < -viewport.x/viewport.scale || 
                             finalX + payload.width > (-viewport.x + viewportWidth)/viewport.scale;
      const isYOutsideView = finalY < -viewport.y/viewport.scale || 
                             finalY + payload.height > (-viewport.y + viewportHeight)/viewport.scale;
      
      // Only adjust viewport if image is outside the current view
      if (isXOutsideView || isYOutsideView) {
        console.log('Image outside view, adjusting viewport');
        const newViewport = {
          ...state.viewport,
          // Keep X position the same since we have vertical scrolling only
          y: -(finalY * state.viewport.scale) + (canvasHeight / 2) - ((payload.height * state.viewport.scale) / 2)
        };
        get().setViewport(newViewport);
      }
    }, 50);

    set({ isGeneratingAI: false }); // Hide loading indicator

    // Select the newly added image to make it immediately editable
    get().setSelectedElementIds(new Set([newImageId]));

    console.log("AI Image element added, viewport adjusted to show image.");
  }
}));

