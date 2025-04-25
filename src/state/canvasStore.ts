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
export const useCanvasStore = create<CanvasStoreState & CanvasStoreActions>((set: any, get: any) => ({
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
    const newSelectedIds = new Set([...state.selectedElementIds].filter(id => !ids.includes(id)));
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
      
      // Convert elements Map to array for storage
      const canvasData = Array.from(get().elements.values());
      
      // Save to localStorage as a backup
      const localStorageKey = `canvas_${userId}_${wordId}`;
      localStorage.setItem(localStorageKey, JSON.stringify(canvasData));
      console.log('Canvas state saved to localStorage');
      
      // Attempt to save to backend
      try {
        const response = await fetch(`/api/user/${userId}/word/${wordId}/canvas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(canvasData),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to save canvas state: ${response.status} ${response.statusText}`);
        }
        
        // Handle response if needed
        const result = await response.json();
        console.log('Canvas state saved to server', result);
      } catch (apiError) {
        console.error('API unavailable or error occurred:', apiError);
        
        if (process.env.NODE_ENV === 'development') {
          console.info('Development mode: Backend API not implemented yet, using localStorage');
          return; // Exit without throwing since localStorage save succeeded
        }
        throw apiError; // Re-throw for other errors
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

  // --- AI Interaction Placeholder ---
  handleAIImageCommand: (payload: { imageId: string; imageUrl: string; width: number; height: number; placementHint?: string }) => {
    console.log("Received ADD_IMAGE_ELEMENT command, processing:", payload);
    set({ isGeneratingAI: true }); // Show loading while we place it

    // --- Non-Destructive Placement Logic (Placeholder - Simple Offset) ---
    // This needs to be significantly more robust in the real implementation
    const state = get();
    const newImageId = payload.imageId || `ai-img-${Date.now()}`; // Use provided ID or generate one

    // Get viewport center for better placement
    const viewport = state.viewport;
    let centerX = 0;
    let centerY = 0;
    
    // If we have a viewport, center the image in the visible area
    if (viewport) {
      // Use canvas center as focal point
      const visibleWidth = window.innerWidth / viewport.scale;
      const visibleHeight = window.innerHeight / viewport.scale;
      centerX = (-viewport.x / viewport.scale) + (visibleWidth / 2);
      centerY = (-viewport.y / viewport.scale) + (visibleHeight / 2);
    } else {
      // Fallback to fixed position if no viewport info
      centerX = 200;
      centerY = 200;
    }
    
    // Center the image around the calculated position
    const finalX = centerX - (payload.width / 2);
    const finalY = centerY - (payload.height / 2);

    // --- End Improved Placement Logic ---

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
    // Update viewport to center on the new image
    const newViewport = {
      ...state.viewport,
      x: -(finalX * state.viewport.scale) + (window.innerWidth / 2) - ((payload.width * state.viewport.scale) / 2),
      y: -(finalY * state.viewport.scale) + (window.innerHeight / 2) - ((payload.height * state.viewport.scale) / 2)
    };
    get().setViewport(newViewport);

    set({ isGeneratingAI: false }); // Hide loading indicator

    // Select the newly added image to make it immediately editable
    get().setSelectedElementIds(new Set([newImageId]));

    console.log("AI Image element added, viewport adjusted to show image.");
  }
}));
