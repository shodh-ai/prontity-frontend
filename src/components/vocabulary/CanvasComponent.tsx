'use client';

import React, { useRef, useEffect, useState } from 'react';

// Import react-konva components directly since this component
// is only loaded on the client side through dynamic imports
import { Stage, Layer, Line, Rect, Text, Image, Transformer } from 'react-konva';
import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { useCanvasStore, CanvasStoreState, CanvasStoreActions, DrawingElement, ImageElement } from '@/state/canvasStore';

interface CanvasComponentProps {
  width?: number;
  height?: number;
}

const CanvasComponent: React.FC<CanvasComponentProps> = ({
  width = window.innerWidth,
  height = window.innerHeight * 0.6,
}) => {
  const stageRef = useRef<Konva.Stage>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  
  // Get the store instance (includes state and actions)
  const canvasStore = useCanvasStore();
  
  // We'll need to use useState and useEffect to track store values locally in the component
  // Extract initial state from the store by calling getState() on the hook itself
  const initialStoreState = useCanvasStore.getState();
  
  // Set up local state for store values
  const [elements, setElements] = useState<Map<string, DrawingElement>>(initialStoreState.elements);
  const [viewport, setViewportState] = useState(initialStoreState.viewport);
  const [currentTool, setCurrentToolState] = useState(initialStoreState.currentTool);
  const [toolOptions, setToolOptionsState] = useState(initialStoreState.toolOptions);
  const [selectedElementIds, setSelectedElementIdsState] = useState(initialStoreState.selectedElementIds);
  const [isDrawing, setIsDrawingState] = useState(initialStoreState.isDrawing);
  
  // Set up a subscription to the store
  useEffect(() => {
    // This code creates a subscription to the store that updates our local state
    // whenever the store changes
    const unsubscribe = useCanvasStore.subscribe((state: CanvasStoreState & CanvasStoreActions) => {
      setElements(state.elements);
      setViewportState(state.viewport);
      setCurrentToolState(state.currentTool);
      setToolOptionsState(state.toolOptions);
      setSelectedElementIdsState(state.selectedElementIds);
      setIsDrawingState(state.isDrawing);
    });
    
    // Clean up subscription when component unmounts
    return () => unsubscribe();
  }, [canvasStore]);
  
  // Wrap store actions with local functions
  const setIsDrawing = (value: boolean) => canvasStore.setIsDrawing(value);
  const addElement = (element: DrawingElement) => canvasStore.addElement(element);
  const updateElement = (id: string, updates: Partial<DrawingElement>) => canvasStore.updateElement(id, updates);
  const updateViewport = (updates: Partial<{ x: number; y: number; scale: number }>) => canvasStore.updateViewport(updates);
  const setSelectedElementIds = (ids: Set<string>) => canvasStore.setSelectedElementIds(ids);
  
  // Local state for drawing path
  const [currentPath, setCurrentPath] = useState<number[]>([]);
  
  // Load images for elements
  const [loadedImages, setLoadedImages] = useState<Record<string, HTMLImageElement>>({});
  
  useEffect(() => {
    // Handle window resize
    const handleResize = () => {
      if (stageRef.current) {
        stageRef.current.width(window.innerWidth);
        stageRef.current.height(window.innerHeight * 0.6);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Load images when image elements are added
  useEffect(() => {
    const elementsArray = Array.from(elements.values());
    const imageElements = elementsArray.filter(el => el.type === 'image');
    
    imageElements.forEach(imgEl => {
      // Skip if already loaded
      if (loadedImages[imgEl.id]) return;
      
      const img = new window.Image();
      img.src = (imgEl as ImageElement).imageUrl;
      img.onload = () => {
        setLoadedImages(prev => ({
          ...prev,
          [imgEl.id]: img
        }));
      };
    });
  }, [elements, loadedImages]);
  
  // Update transformer when selection changes
  useEffect(() => {
    if (!transformerRef.current || !layerRef.current) return;
    
    const selectedNodes = Array.from(selectedElementIds).map(id => 
      layerRef.current?.findOne(`.${id}`)
    ).filter(Boolean);
    
    transformerRef.current.nodes(selectedNodes as Konva.Node[]);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedElementIds]);
  
  // Mouse event handlers
  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) {
      // Clicked on empty canvas
      setSelectedElementIds(new Set());
      
      if (currentTool === 'pencil') {
        setIsDrawing(true);
        
        const pointerPos = e.target.getStage()?.getPointerPosition();
        if (!pointerPos) return;
        
        // Adjust for viewport position and scale
        const x = (pointerPos.x - viewport.x) / viewport.scale;
        const y = (pointerPos.y - viewport.y) / viewport.scale;
        
        setCurrentPath([x, y]);
      } else if (currentTool === 'pan') {
        // For panning the canvas, handled by dragmove
      }
    }
  };
  
  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (!isDrawing || currentTool !== 'pencil') return;
    
    const pointerPos = e.target.getStage()?.getPointerPosition();
    if (!pointerPos) return;
    
    // Adjust for viewport position and scale
    const x = (pointerPos.x - viewport.x) / viewport.scale;
    const y = (pointerPos.y - viewport.y) / viewport.scale;
    
    setCurrentPath(prev => [...prev, x, y]);
  };
  
  const handleMouseUp = () => {
    if (isDrawing && currentTool === 'pencil' && currentPath.length > 2) {
      // Save the path as a new element
      const newElement: DrawingElement = {
        id: `path-${Date.now()}`,
        type: 'pencil',
        x: 0,
        y: 0,
        points: currentPath,
        stroke: toolOptions.strokeColor,
        strokeWidth: toolOptions.strokeWidth,
      };
      
      addElement(newElement);
      setCurrentPath([]);
    }
    
    setIsDrawing(false);
  };
  
  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    
    const stage = stageRef.current;
    if (!stage) return;
    
    const oldScale = viewport.scale;
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    
    const mousePointTo = {
      x: (pointerPos.x - viewport.x) / oldScale,
      y: (pointerPos.y - viewport.y) / oldScale,
    };
    
    // Handle zoom with mouse wheel
    const newScale = e.evt.deltaY < 0 ? oldScale * 1.1 : oldScale / 1.1;
    
    // Limit zoom scale between 0.1 and 10
    const limitedScale = Math.min(Math.max(newScale, 0.1), 10);
    
    const newPos = {
      x: pointerPos.x - mousePointTo.x * limitedScale,
      y: pointerPos.y - mousePointTo.y * limitedScale,
    };
    
    updateViewport({
      x: newPos.x,
      y: newPos.y,
      scale: limitedScale
    });
  };
  
  const handleDragStart = (e: KonvaEventObject<DragEvent>) => {
    const id = e.target.id();
    if (!id) return;
    
    setSelectedElementIds(new Set([id]));
  };
  
  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    const id = e.target.id();
    if (!id) return;
    
    updateElement(id, {
      x: e.target.x(),
      y: e.target.y(),
    });
  };
  
  const handleStageDragMove = (e: KonvaEventObject<DragEvent>) => {
    if (currentTool !== 'pan') return;
    
    const stage = e.target as Konva.Stage;
    updateViewport({
      x: stage.x(),
      y: stage.y(),
    });
  };
  
  return (
    <div className="canvas-container" style={{ width: '100%', height, border: '1px solid #ccc', overflow: 'hidden', position: 'relative' }}>
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        draggable={currentTool === 'pan'}
        onDragMove={handleStageDragMove}
        x={viewport.x}
        y={viewport.y}
        scale={{ x: viewport.scale, y: viewport.scale }}
      >
        <Layer ref={layerRef}>
          {/* Render all saved elements */}
          {Array.from(elements.entries()).map(([id, element]) => {
            if (element.type === 'pencil' || element.type === 'line') {
              return (
                <Line
                  key={id}
                  id={id}
                  className={id}
                  points={element.points}
                  stroke={element.stroke}
                  strokeWidth={element.strokeWidth}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  draggable={currentTool === 'select'}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              );
            } else if (element.type === 'image' && loadedImages[id]) {
              return (
                <Image
                  key={id}
                  id={id}
                  className={id}
                  image={loadedImages[id]}
                  x={element.x}
                  y={element.y}
                  width={element.width}
                  height={element.height}
                  rotation={element.rotation || 0}
                  opacity={element.opacity || 1}
                  draggable={currentTool === 'select'}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              );
            } else if (element.type === 'text') {
              return (
                <Text
                  key={id}
                  id={id}
                  className={id}
                  x={element.x}
                  y={element.y}
                  text={element.text}
                  fontSize={element.fontSize || 20}
                  fill={element.fill || '#000000'}
                  draggable={currentTool === 'select'}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              );
            }
            return null;
          })}
          
          {/* Current drawing path */}
          {isDrawing && currentTool === 'pencil' && (
            <Line
              points={currentPath}
              stroke={toolOptions.strokeColor}
              strokeWidth={toolOptions.strokeWidth}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
            />
          )}
          
          {/* Selection transformer */}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              // Limit resize to stay within stage
              if (newBox.width < 5 || newBox.height < 5) {
                return oldBox;
              }
              return newBox;
            }}
          />
        </Layer>
      </Stage>
      
      {/* Loading overlay */}
      {false && (
        <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center text-white">
          Loading...
        </div>
      )}
    </div>
  );
};

export default CanvasComponent;
