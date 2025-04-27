'use client';

import React from 'react';
import { useCanvasStore } from '@/state/canvasStore';

const ToolBar: React.FC = () => {
  // Use Zustand selectors to get state directly
  const currentTool = useCanvasStore(state => state.currentTool);
  const viewport = useCanvasStore(state => state.viewport);
  const toolOptions = useCanvasStore(state => state.toolOptions);
  
  // Get action functions directly from the store
  const setCurrentTool = useCanvasStore(state => state.setCurrentTool);
  const setToolOptions = useCanvasStore(state => state.setToolOptions);
  const updateViewport = useCanvasStore(state => state.updateViewport);
  
  // Zoom actions
  const zoomIn = () => {
    const newScale = viewport.scale * 1.2; // 20% zoom in
    updateViewport({ scale: Math.min(newScale, 10) }); // Max zoom of 10x
  };
  
  const zoomOut = () => {
    const newScale = viewport.scale / 1.2; // 20% zoom out
    updateViewport({ scale: Math.max(newScale, 0.1) }); // Min zoom of 0.1x
  };
  
  const resetZoom = () => {
    updateViewport({ scale: 1 }); // Reset to 100%
  };
  
  // Color options for the drawing tools
  const colorOptions = [
    { name: 'Black', value: '#000000' },
    { name: 'Red', value: '#FF0000' },
    { name: 'Blue', value: '#0000FF' },
    { name: 'Green', value: '#00FF00' },
    { name: 'Yellow', value: '#FFFF00' },
  ];

  // Stroke width options
  const strokeWidthOptions = [
    { name: 'Thin', value: 2 },
    { name: 'Medium', value: 5 },
    { name: 'Thick', value: 10 },
  ];

  return (
    <div className="tool-bar bg-white p-3 rounded-lg shadow-md">
      <div className="flex justify-between mb-4">
        {/* Drawing Tools */}
        <div className="tools flex space-x-2">
          <button
            className={`tool-btn p-2 rounded ${currentTool === 'select' ? 'bg-blue-100 border border-blue-500' : 'bg-gray-100'}`}
            onClick={() => setCurrentTool('select')}
            title="Select"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path>
            </svg>
          </button>
          
          <button
            className={`tool-btn p-2 rounded ${currentTool === 'pencil' ? 'bg-blue-100 border border-blue-500' : 'bg-gray-100'}`}
            onClick={() => setCurrentTool('pencil')}
            title="Pencil"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
            </svg>
          </button>
          
          <button
            className={`tool-btn p-2 rounded ${currentTool === 'rectangle' ? 'bg-blue-100 border border-blue-500' : 'bg-gray-100'}`}
            onClick={() => setCurrentTool('rectangle')}
            title="Rectangle"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            </svg>
          </button>
          
          <button
            className={`tool-btn p-2 rounded ${currentTool === 'text' ? 'bg-blue-100 border border-blue-500' : 'bg-gray-100'}`}
            onClick={() => setCurrentTool('text')}
            title="Text"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 7 4 4 20 4 20 7"></polyline>
              <line x1="9" y1="20" x2="15" y2="20"></line>
              <line x1="12" y1="4" x2="12" y2="20"></line>
            </svg>
          </button>
          
          <button
            className={`tool-btn p-2 rounded ${currentTool === 'pan' ? 'bg-blue-100 border border-blue-500' : 'bg-gray-100'}`}
            onClick={() => setCurrentTool('pan')}
            title="Pan Canvas"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
          </button>
        </div>
        
        {/* Zoom Controls */}
        <div className="zoom-controls flex items-center space-x-2">
          <button
            className="zoom-btn p-2 rounded bg-gray-100 hover:bg-gray-200"
            onClick={zoomOut}
            title="Zoom Out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </button>
          
          <div className="zoom-display text-sm font-mono">
            {Math.round(viewport.scale * 100)}%
          </div>
          
          <button
            className="zoom-btn p-2 rounded bg-gray-100 hover:bg-gray-200"
            onClick={zoomIn}
            title="Zoom In"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="11" y1="8" x2="11" y2="14"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </button>
          
          <button
            className="reset-zoom-btn p-2 rounded bg-gray-100 hover:bg-gray-200"
            onClick={resetZoom}
            title="Reset Zoom"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 2v6h6"></path>
              <path d="M21 12A9 9 0 0 0 6 5.3L3 8"></path>
              <path d="M21 22v-6h-6"></path>
              <path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"></path>
            </svg>
          </button>
        </div>
      </div>
      
      {/* Tool option controls - only show when drawing tools are selected */}
      {(currentTool === 'pencil' || currentTool === 'rectangle' || currentTool === 'text') && (
        <div className="tool-options">
          <div className="color-selector flex flex-wrap gap-2 mb-3">
            {colorOptions.map(color => (
              <div
                key={color.value}
                className={`color-option w-6 h-6 rounded-full cursor-pointer ${toolOptions.strokeColor === color.value ? 'ring-2 ring-blue-500' : ''}`}
                style={{ backgroundColor: color.value }}
                onClick={() => setToolOptions({ strokeColor: color.value, fill: color.value })}
                title={color.name}
              />
            ))}
          </div>
          
          {(currentTool === 'pencil' || currentTool === 'rectangle') && (
            <div className="stroke-width-selector flex gap-2">
              {strokeWidthOptions.map(option => (
                <button
                  key={option.value}
                  className={`stroke-option px-2 py-1 text-xs rounded ${toolOptions.strokeWidth === option.value ? 'bg-blue-100 border border-blue-500' : 'bg-gray-100'}`}
                  onClick={() => setToolOptions({ strokeWidth: option.value })}
                >
                  {option.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ToolBar;
