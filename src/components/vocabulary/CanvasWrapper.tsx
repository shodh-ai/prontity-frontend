'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Stage, Layer, Line, Rect, Text, Image, Transformer } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { useCanvasStore } from '@/state/canvasStore';
import { DrawingElement } from '@/state/canvasStore';
import { v4 as uuidv4 } from 'uuid';

const CanvasWrapper: React.FC = () => {
  const [error, setError] = useState<Error | null>(null);
  const [isClient, setIsClient] = useState(false);
  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const [windowSize, setWindowSize] = useState({ width: 800, height: 400 });

  // Access state from the canvas store using selector pattern
  const elements = useCanvasStore(state => state.elements);
  const viewport = useCanvasStore(state => state.viewport);
  const currentTool = useCanvasStore(state => state.currentTool);
  const toolOptions = useCanvasStore(state => state.toolOptions);
  const selectedElementIds = useCanvasStore(state => state.selectedElementIds);
  const isDrawing = useCanvasStore(state => state.isDrawing);
  const isLoading = useCanvasStore(state => state.isLoading);
  
  // Access actions from the canvas store
  const addElement = useCanvasStore(state => state.addElement);
  const updateElement = useCanvasStore(state => state.updateElement);
  const updateViewport = useCanvasStore(state => state.updateViewport);
  const setSelectedElementIds = useCanvasStore(state => state.setSelectedElementIds);
  const setIsDrawing = useCanvasStore(state => state.setIsDrawing);

  // Handle window resize
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleResize = () => {
        setWindowSize({
          width: Math.min(window.innerWidth * 0.8, 1000),
          height: 400
        });
      };

      // Set initial size
      handleResize();

      // Add event listener
      window.addEventListener('resize', handleResize);
      
      // Clean up
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Handle client-side initialization
  useEffect(() => {
    setIsClient(true);
    console.log('Canvas Wrapper mounted');
    
    // Try to load Konva and catch any errors
    try {
      const konva = require('konva');
      console.log('Konva loaded successfully:', konva.version);
    } catch (err) {
      console.error('Failed to load Konva:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    }
    
    return () => console.log('Canvas Wrapper unmounted');
  }, []);

  // Handle transformer updates when selection changes
  useEffect(() => {
    if (transformerRef.current && selectedElementIds.size > 0) {
      const stage = stageRef.current;
      if (!stage) return;

      const nodes = Array.from(selectedElementIds).map(id => {
        return stage.findOne(`#${id}`);
      }).filter(Boolean);

      transformerRef.current.nodes(nodes);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [selectedElementIds]);

  // Handle mouse down events based on current tool
  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    if (isLoading) return;

    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;

    const x = (pos.x - viewport.x) / viewport.scale;
    const y = (pos.y - viewport.y) / viewport.scale;

    if (currentTool === 'select') {
      // Handle selection
      const clickedOnEmpty = e.target === e.target.getStage();
      if (clickedOnEmpty) {
        setSelectedElementIds(new Set());
        return;
      }

      // Don't do anything on the transformer
      const clickedOnTransformer = e.target.getParent()?.className === 'Transformer';
      if (clickedOnTransformer) {
        return;
      }

      // Find the clicked element ID
      const id = e.target.id();
      if (id) {
        setSelectedElementIds(new Set([id]));
      }
    } else if (currentTool === 'pencil') {
      // Start drawing a new line
      const id = uuidv4();
      addElement({
        id,
        type: 'line', // Use 'line' type for pencil tool, actual drawing happens in mouseMove
        x, // Add starting x
        y, // Add starting y
        points: [x, y],
        stroke: toolOptions.strokeColor,
        strokeWidth: toolOptions.strokeWidth,
      });
      setIsDrawing(true);
    } else if (currentTool === 'rectangle') {
      // Start drawing a rectangle
      const id = uuidv4();
      addElement({
        id,
        type: 'rectangle',
        x,
        y,
        width: 0,
        height: 0,
        stroke: toolOptions.strokeColor,
        strokeWidth: toolOptions.strokeWidth,
        fill: 'transparent',
      });
      setIsDrawing(true);
    } else if (currentTool === 'text') {
      // Add a new text element
      const id = uuidv4();
      addElement({
        id,
        type: 'text',
        x,
        y,
        text: 'Double click to edit',
        fontSize: 16,
        fill: toolOptions.strokeColor,
      });
      setSelectedElementIds(new Set([id]));
    } else if (currentTool === 'pan') {
      // Set panning mode
      const stage = stageRef.current;
      if (stage) {
        stage.draggable(true);
      }
    }
  };

  // Handle mouse move events
  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (!isDrawing || isLoading) return;

    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;

    const x = (pos.x - viewport.x) / viewport.scale;
    const y = (pos.y - viewport.y) / viewport.scale;

    // Get the last element (which we're drawing)
    const elementsArray = Array.from(elements.values());
    const lastElement = elementsArray[elementsArray.length - 1] as DrawingElement;

    if (lastElement) {
      // Update based on element type
      if (lastElement.type === 'line') {
        const newPoints = [...(lastElement.points as number[]), x, y];
        updateElement(lastElement.id, { points: newPoints });
      } else if (lastElement.type === 'rectangle') {
        // Calculate width and height based on original position and current mouse position
        const width = x - (lastElement.x as number);
        const height = y - (lastElement.y as number);
        updateElement(lastElement.id, { width, height });
      }
    }
  };

  // Handle mouse up events
  const handleMouseUp = () => {
    if (currentTool === 'pan') {
      // Disable dragging when pan tool is released
      const stage = stageRef.current;
      if (stage) {
        stage.draggable(false);
      }
    }
    
    // Stop drawing
    setIsDrawing(false);
  };

  // Handle stage drag (for panning)
  const handleStageDragMove = (e: KonvaEventObject<DragEvent>) => {
    if (currentTool !== 'pan') return;
    
    const stage = e.target;
    updateViewport({ x: stage.x(), y: stage.y() });
  };

  // Handle wheel for zooming
  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    
    const stage = stageRef.current;
    if (!stage) return;
    
    const oldScale = viewport.scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    
    const mousePointTo = {
      x: (pointer.x - viewport.x) / oldScale,
      y: (pointer.y - viewport.y) / oldScale,
    };
    
    // Calculate new scale: zoom in on scroll up, zoom out on scroll down
    const newScale = e.evt.deltaY < 0 ? oldScale * 1.1 : oldScale / 1.1;
    
    // Calculate new stage position to zoom around mouse position
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    
    // Update viewport in store
    updateViewport({ x: newPos.x, y: newPos.y, scale: newScale });
  };

  // Render error message if Konva fails to load
  if (error) {
    return (
      <div className="canvas-error w-full h-[400px] bg-red-50 rounded-lg flex items-center justify-center p-4">
        <div className="text-center">
          <h3 className="text-red-500 font-bold mb-2">Canvas Error</h3>
          <p className="text-red-700">{error.message}</p>
          <p className="text-sm text-gray-500 mt-2">Check browser console for details.</p>
        </div>
      </div>
    );
  }

  // Show loading state on server or when canvas is not ready
  if (!isClient) {
    return (
      <div className="canvas-loading w-full h-[400px] bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-gray-500 text-center">
          <div className="mb-2">Loading drawing canvas...</div>
          <div className="w-8 h-8 border-t-2 border-blue-500 rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  // Render the canvas
  return (
    <div className="canvas-container w-full h-[400px] border border-gray-300 rounded-lg overflow-hidden relative">
      <Stage
        ref={stageRef}
        width={windowSize.width}
        height={windowSize.height}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        onMouseDown={handleMouseDown}
        onMousemove={handleMouseMove}
        onMouseup={handleMouseUp}
        onWheel={handleWheel}
        onDragMove={handleStageDragMove}
        draggable={currentTool === 'pan'}
      >
        <Layer>
          {/* Render all drawing elements */}
          {Array.from(elements.entries()).map(([id, element]) => {
            const elem = element as DrawingElement;
            if (elem.type === 'line') {
              return (
                <Line
                  key={id}
                  id={id}
                  points={elem.points as number[]}
                  stroke={elem.stroke as string}
                  strokeWidth={elem.strokeWidth as number}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  draggable={currentTool === 'select'}
                />
              );
            } else if (elem.type === 'rectangle') {
              return (
                <Rect
                  key={id}
                  id={id}
                  x={elem.x as number}
                  y={elem.y as number}
                  width={elem.width as number}
                  height={elem.height as number}
                  stroke={elem.stroke as string}
                  strokeWidth={elem.strokeWidth as number}
                  fill={elem.fill as string}
                  draggable={currentTool === 'select'}
                  cornerRadius={4}
                />
              );
            } else if (elem.type === 'text') {
              return (
                <Text
                  key={id}
                  id={id}
                  x={elem.x as number}
                  y={elem.y as number}
                  text={elem.text as string}
                  fontSize={elem.fontSize as number}
                  fill={elem.fill as string}
                  draggable={currentTool === 'select'}
                />
              );
            } else if (elem.type === 'image') {
              // We'll implement image rendering when we handle AI-generated images
              // For now we'll add a placeholder
              return (
                <Rect
                  key={id}
                  id={id}
                  x={elem.x as number}
                  y={elem.y as number}
                  width={elem.width as number || 100}
                  height={elem.height as number || 100}
                  fill="#F0F0F0"
                  stroke="#CCCCCC"
                  strokeWidth={1}
                  draggable={currentTool === 'select'}
                />
              );
            }
            return null;
          })}

          {/* Transformer for selected elements */}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              // Prevent resizing too small
              if (newBox.width < 5 || newBox.height < 5) {
                return oldBox;
              }
              return newBox;
            }}
          />
        </Layer>
      </Stage>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-t-2 border-blue-500 rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-gray-700">Loading canvas...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CanvasWrapper;
