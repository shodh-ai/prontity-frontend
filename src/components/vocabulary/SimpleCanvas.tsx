'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Line, Rect, Text, Transformer } from 'react-konva';
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
import AIGeneratedImage from './AIGeneratedImage';
import DirectImageEditor from './DirectImageEditor';
import { editImage } from '@/api/imageGeneration';

const SimpleCanvas: React.FC = () => {
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

  const [isDrawing, setIsDrawing] = useState(false);
  const [editingText, setEditingText] = useState<{ id: string; text: string } | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  
  // New state for image editing outside of Konva
  const [editingImage, setEditingImage] = useState<{ element: ImageElement; imageUrl: string } | null>(null);
  
  const stageRef = useRef<Konva.Stage>(null); 
  const transformerRef = useRef<Konva.Transformer>(null); 
  
  const [stageSize, setStageSize] = useState({ width: 800, height: 400 });
  const [editError, setEditError] = useState<string | null>(null);
  
  useEffect(() => {
    const updateSize = () => {
      const container = stageRef.current?.container().parentElement;
      setStageSize({
        width: container?.clientWidth ?? Math.min(window.innerWidth * 0.8, 1000),
        height: container?.clientHeight ?? 400
      });
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  
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
    
    node.scaleX(1);
    node.scaleY(1);
    
    const baseUpdates = {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
    };
    
    if (element.type === 'rectangle' || element.type === 'image') {
      updateElement(id, {
        ...baseUpdates,
        width: Math.max(5, (node.width() ?? 0) * scaleX),
        height: Math.max(5, (node.height() ?? 0) * scaleY),
      });
    } else {
      updateElement(id, baseUpdates);
    }
  }, [elements, updateElement]);
  
  const handleStageMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    // Detect if we clicked on stage but not on any shape
    const clickedOnEmpty = e.target === e.target.getStage();
    
    if (clickedOnEmpty) {
      // Clear selection when clicking empty area
      setSelectedIds(new Set());
      
      if (currentTool === 'text') {
        // Add a new text element where clicked
        const stage = e.target.getStage();
        if (!stage) return;
        
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        
        // Adjust position for viewport transformation
        const adjustedPos = {
          x: (pointer.x - stage.x()) / stage.scaleX(),
          y: (pointer.y - stage.y()) / stage.scaleY(),
        };
        
        const newTextElement: TextElement = {
          id: `text-${uuidv4()}`,
          type: 'text',
          x: adjustedPos.x,
          y: adjustedPos.y,
          text: 'Double-click to edit',
          fontSize: 20,
          fill: 'black',
        };
        
        addElement(newTextElement);
        setEditingText({ id: newTextElement.id, text: newTextElement.text });
      }
      else if (currentTool === 'rectangle') {
        // Start drawing rectangle
        setIsDrawing(true);
        
        const stage = e.target.getStage();
        if (!stage) return;
        
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        
        // Adjust position for viewport transformation
        const adjustedPos = {
          x: (pointer.x - stage.x()) / stage.scaleX(),
          y: (pointer.y - stage.y()) / stage.scaleY(),
        };
        
        const newRectElement: RectangleElement = {
          id: `rect-${uuidv4()}`,
          type: 'rectangle',
          x: adjustedPos.x,
          y: adjustedPos.y,
          width: 0,
          height: 0,
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          fill: 'transparent',
        };
        
        addElement(newRectElement);
        setSelectedIds(new Set([newRectElement.id]));
      }
      else if (currentTool === 'pencil') {
        // Start drawing line
        setIsDrawing(true);
        
        const stage = e.target.getStage();
        if (!stage) return;
        
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        
        // Adjust position for viewport transformation
        const adjustedPos = {
          x: (pointer.x - stage.x()) / stage.scaleX(),
          y: (pointer.y - stage.y()) / stage.scaleY(),
        };
        
        const newLineElement: LineElement = {
          id: `line-${uuidv4()}`,
          type: 'pencil',
          x: 0,
          y: 0,
          points: [adjustedPos.x, adjustedPos.y],
          stroke: strokeColor,
          strokeWidth: strokeWidth,
        };
        
        addElement(newLineElement);
        setSelectedIds(new Set([newLineElement.id]));
      }
      else if (currentTool === 'pan') {
        // For panning, only allow vertical movement
        const stage = e.target.getStage();
        if (stage) {
          stage.draggable(true);
          
          // Store original x position for restricting horizontal movement
          // Using data attribute instead of custom property
          stage.attrs.originalX = viewport.x;
        }
      }
    }
  }, [currentTool, setSelectedIds, addElement, strokeColor, strokeWidth, viewport.x]); 

  // Handle image edit requests
  const handleImageEdit = useCallback(async (element: ImageElement, newImageData: string, prompt: string) => {
    try {
      setIsProcessingImage(true);
      setEditError(null);

      // Call the API to edit the image with Gemini
      const result = await editImage(newImageData, prompt);
      console.log('Edit image result:', result);
      
      if (result.success && result.imageData) {
        // The API now returns a complete data URL, so use it directly
        const imageUrl = result.imageData;
        
        // Update the existing element with the new image
        updateElement(element.id, {
          imageUrl: imageUrl,
          metadata: {
            ...element.metadata,
            prompt: prompt,
            originalImage: element.imageUrl, // Store original for possible reversion
            generationDate: new Date().toISOString()
          }
        });
        
        console.log('Image successfully edited');
      } else {
        console.error('Failed to edit image:', result.error);
        setEditError(result.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error editing image:', error);
      setEditError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsProcessingImage(false);
    }
  }, [updateElement]);

  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (!isDrawing) return;

    const stage = stageRef.current; 
    const pos = stage?.getPointerPosition();
    if (!pos || !stage) return;

    const x = (pos.x - viewport.x) / viewport.scale;
    const y = (pos.y - viewport.y) / viewport.scale;

    const currentDrawingId = Array.from(selectedIds).pop();
    if (!currentDrawingId) return; 

    const element = elements.get(currentDrawingId);
    if (!element) return;

    switch (element.type) {
      case 'line': {
        const points = element.points ? [...element.points, x, y] : [x, y];
        updateElement(currentDrawingId, { points });
        break;
      }
      case 'rectangle': {
        const startX = element.x ?? 0;
        const startY = element.y ?? 0;
        const width = x - startX;
        const height = y - startY;

        updateElement(currentDrawingId, {
          x: width < 0 ? x : startX,
          y: height < 0 ? y : startY,
          width: Math.abs(width),
          height: Math.abs(height),
        });
        break;
      }
      default:
        break;
    }
  }, [isDrawing, elements, selectedIds, updateElement, viewport]); 

  const handleMouseUp = useCallback(() => {
    if (isDrawing) {
       setIsDrawing(false);
    }
  }, [isDrawing]); 

  const handleTextDblClick = useCallback((id: string) => {
    const element = elements.get(id);
    if (!element || element.type !== 'text') return;

    setSelectedIds(new Set([id]));
    setEditingText({ id, text: element.text || '' });

    transformerRef.current?.nodes([]);

    const textNode = stageRef.current?.findOne(`#${id}`);
    if (!textNode) return;

    const konvaTextNode = textNode as Konva.Text;

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    const stageBox = stageRef.current?.container().getBoundingClientRect();
    if (!stageBox) { 
      document.body.removeChild(textarea); 
      return;
    }
    const textPosition = textNode.getAbsolutePosition();
    const areaPosition = {
      x: stageBox.left + textPosition.x * viewport.scale + viewport.x,
      y: stageBox.top + textPosition.y * viewport.scale + viewport.y,
    };

    const rotation = textNode.rotation();
    const scale = textNode.getAbsoluteScale().x * viewport.scale;
    const fontSize = (element.fontSize || 20) * scale;

    Object.assign(textarea.style, {
      position: 'absolute',
      top: `${areaPosition.y}px`,
      left: `${areaPosition.x}px`,
      width: `${(textNode.width() ?? 100) * scale}px`, 
      height: `${((konvaTextNode.height() ?? 20) * scale) + fontSize}px`, 
      fontSize: `${fontSize}px`,
      border: '1px solid #ccc',
      padding: '0px',
      margin: '0px',
      overflow: 'hidden',
      background: 'white',
      outline: 'none',
      resize: 'none',
      lineHeight: konvaTextNode.lineHeight().toString(), 
      fontFamily: konvaTextNode.fontFamily(),
      transformOrigin: 'left top',
      transform: `rotateZ(${rotation}deg)`, 
      zIndex: '1000',
    });

    textarea.value = element.text || '';
    textarea.focus();

    const cleanupAndSave = (newText: string, shouldSave: boolean = true) => {
      if (textarea.parentNode) {
        textarea.parentNode.removeChild(textarea);
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleOutsideClick); 
      textarea.removeEventListener('blur', handleBlur);

      if (shouldSave && editingText) {
        updateElement(editingText.id, { text: newText });
      }
      
      if (selectedIds.has(id)) {
        const node = stageRef.current?.findOne(`#${id}`);
        if (node && transformerRef.current) {
           transformerRef.current.nodes([node]);
           transformerRef.current.getLayer()?.batchDraw();
        }
      }
      setEditingText(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        cleanupAndSave(textarea.value);
      } else if (e.key === 'Escape') {
        cleanupAndSave(editingText?.text || '', false);
      }
    };
    const handleOutsideClick = (e: MouseEvent) => {
      if (e.target !== textarea) {
          cleanupAndSave(textarea.value);
      }
    };
    const handleBlur = () => {
      setTimeout(() => {
         if (document.activeElement !== textarea) {
             cleanupAndSave(textarea.value);
         }
      }, 50);
    };

    textarea.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleOutsideClick);
    textarea.addEventListener('blur', handleBlur);
  }, [elements, selectedIds, setSelectedIds, updateElement, viewport]); 

  const handleStageWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    
    // For vertical scrolling only - don't change scale on wheel
    const stage = stageRef.current;
    if (!stage) return;
    
    // Current viewport
    const currentY = viewport.y;
    
    // Calculate new Y position based on wheel delta
    // Using deltaY directly for vertical scrolling
    const newY = currentY + e.evt.deltaY * -1;
    
    // Apply the new position, but keep X position fixed to restrict horizontal scrolling
    setViewport({
      ...viewport,
      y: newY,
      // Keep x position fixed to prevent horizontal scrolling
      x: viewport.x
    });
  }, [setViewport, viewport]); 

  const handleStageDragMove = useCallback((e: KonvaEventObject<DragEvent>) => {
    if (currentTool === 'pan') {
      const stage = e.target.getStage();
      if (stage) {
        // Restrict to vertical movement only
        // Use the stored original X position for horizontal
        setViewport({ 
          x: stage.attrs.originalX || viewport.x, // Restrict x to original position
          y: stage.y(), // Allow y to change
          scale: stage.scaleX() 
        });
        
        // Force the stage x position to remain fixed
        stage.x(stage.attrs.originalX || viewport.x);
      }
    }
  }, [currentTool, setViewport, viewport.x]); 
  
  const elementsArray: [string, DrawingElement][] = Array.from(elements.entries());

  return (
    <div className="relative w-full h-full border border-gray-300 overflow-hidden bg-gray-50">
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        x={viewport.x}
        y={viewport.y}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleStageWheel}
        onDragMove={handleStageDragMove}
        draggable={currentTool === 'pan'}
      >
        <Layer>
          {/* Render image elements */}
          {elementsArray
            .filter((entry): entry is [string, ImageElement] => entry[1].type === 'image')
            .map(([id, element]) => {
              return (
                <AIGeneratedImage
                  key={id}
                  element={element}
                  isSelected={selectedIds.has(id)}
                  onSelect={() => handleElementClick(id)}
                  onDragEnd={e => handleElementDragEnd(id, e)}
                  onTransformEnd={e => handleTransformEnd(id, e)}
                  viewportScale={viewport.scale}
                  onEdit={(_element, _newImageData, _prompt) => {
                    // This is just a proxy to avoid Konva-related errors
                    // Actual editing happens in the modal component
                    setEditingImage({ element, imageUrl: element.imageUrl });
                    return Promise.resolve();
                  }}
                />
              );
            })}
          {/* Render line elements */}
          {elementsArray
            .filter((entry): entry is [string, LineElement] => entry[1].type === 'line' || entry[1].type === 'pencil')
            .map(([id, element]) => (
              <Line
                key={id}
                id={id}
                points={element.points} 
                stroke={element.stroke}
                strokeWidth={Math.max(0.5, Math.min(element.strokeWidth, 5)) / viewport.scale}
                tension={0.5}
                lineCap="round"
                globalCompositeOperation="source-over"
                onClick={() => handleElementClick(id)}
                onTap={() => handleElementClick(id)}
                draggable={selectedIds.has(id)}
                onDragEnd={e => handleElementDragEnd(id, e)}
              />
            ))}

          {/* Render rectangle elements */}
          {elementsArray
            .filter((entry): entry is [string, RectangleElement] => entry[1].type === 'rectangle')
            .map(([id, element]) => (
              <Rect
                key={id}
                id={id}
                x={element.x}
                y={element.y}
                width={element.width}
                height={element.height}
                stroke={element.stroke}
                strokeWidth={Math.max(0.5, Math.min(element.strokeWidth, 5)) / viewport.scale}
                fill={element.fill || 'transparent'}
                onClick={() => handleElementClick(id)}
                onTap={() => handleElementClick(id)}
                draggable={selectedIds.has(id)}
                onDragEnd={e => handleElementDragEnd(id, e)}
                onTransformEnd={e => handleTransformEnd(id, e)}
                rotation={element.rotation ?? 0}
              />
            ))}

          {/* Render text elements */}
          {elementsArray
            .filter((entry): entry is [string, TextElement] => entry[1].type === 'text')
            .map(([id, element]) => {
              const isEditing = editingText?.id === id;
              return (
                <Text
                  key={id}
                  id={id}
                  x={element.x}
                  y={element.y}
                  text={element.text}
                  fontSize={element.fontSize ?? 20}
                  scaleX={1 / viewport.scale} 
                  scaleY={1 / viewport.scale}
                  fill={element.fill}
                  visible={!isEditing}
                  draggable={selectedIds.has(id)}
                  onDblClick={() => handleTextDblClick(id)}
                  onClick={() => handleElementClick(id)}
                  onTap={() => handleElementClick(id)}
                  onDragEnd={e => handleElementDragEnd(id, e)}
                  onTransformEnd={e => handleTransformEnd(id, e)}
                  rotation={element.rotation ?? 0}
                />
              );
            })}

          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 5 || newBox.height < 5) {
                return oldBox;
              }
              return newBox;
            }}
            rotateEnabled={true} 
            anchorSize={10}
            borderDash={[6, 2]}
          />
        </Layer>
      </Stage>
      
      <div className="absolute bottom-2 right-2 z-10 flex space-x-2 bg-white p-2 rounded shadow">
        <button
          className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
          onClick={() => {
            // Scroll up
            setViewport({
              ...viewport,
              y: viewport.y + 50 // Move up
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
              y: viewport.y - 50 // Move down
            });
          }}
        >
          ↓
        </button>
        <button
          className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
          onClick={() => setViewport({ x: viewport.x, y: 0, scale: viewport.scale })}
        >
          Reset Scroll
        </button>
      </div>
      
      {/* Error Modal */}
      {editError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-700">Image Generation Error</h3>
              <button
                onClick={() => setEditError(null)}
                className="text-gray-400 hover:text-gray-500 rounded-full p-1 hover:bg-gray-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <p className="font-medium text-gray-600">{editError}</p>
          </div>
        </div>
      )}
      
      {/* Loading Indicator */}
      {isProcessingImage && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-700 font-medium">Generating image...</p>
          </div>
        </div>
      )}
      
      {/* Image Editor Modal - Separate from Konva */}
      {editingImage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-700">Edit Image</h3>
              <button
                onClick={() => setEditingImage(null)}
                className="text-gray-400 hover:text-gray-500 rounded-full p-1 hover:bg-gray-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <DirectImageEditor 
              imageUrl={editingImage.imageUrl} 
              onEditComplete={async (editedImageData: string, prompt: string) => {
                await handleImageEdit(editingImage.element, editedImageData, prompt);
                setEditingImage(null); // Close the editor when done
              }}
              initialPrompt={editingImage.element.metadata?.prompt || ''}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleCanvas;
