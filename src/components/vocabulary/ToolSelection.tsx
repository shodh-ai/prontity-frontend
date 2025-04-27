'use client';

import React from 'react';
import { useCanvasStore } from '@/state/canvasStore';

const ToolSelection: React.FC = () => {
  const { 
    currentTool, 
    setCurrentTool,
    toolOptions,
    setToolOptions 
  } = useCanvasStore();

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
    <div className="tool-selection bg-white p-3 rounded-lg shadow-md">
      <div className="tools flex space-x-2 mb-3">
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
      
      {/* Additional tool-specific options can be added here as needed */}
    </div>
  );
};

export default ToolSelection;
