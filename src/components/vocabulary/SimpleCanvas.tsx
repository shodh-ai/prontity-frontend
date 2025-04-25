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
  
  const stageRef = useRef<Konva.Stage>(null); 
  const transformerRef = useRef<Konva.Transformer>(null); 
  
  const [stageSize, setStageSize] = useState({ width: 800, height: 400 });
  
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
  
  const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    
    const clickedNode = e.target;
    const isStage = clickedNode === stage;
    const isTransformer = clickedNode.getParent()?.className === 'Transformer';

    if (!isStage && !isTransformer) {
      const elementId = clickedNode.id();
      if (elementId && elements.has(elementId) && currentTool === 'select') {
         handleElementClick(elementId);
      }
      return; 
    }

    if (currentTool === 'select') {
      setSelectedIds(new Set()); 
      return;
    }

    if (currentTool === 'pan') {
      return;
    }

    setIsDrawing(true);
    const pos = stage.getPointerPosition();
    if (!pos) return;

    const x = (pos.x - viewport.x) / viewport.scale;
    const y = (pos.y - viewport.y) / viewport.scale;
    const id = uuidv4();

    let newElement: DrawingElement | null = null;

    switch (currentTool) {
      case 'pencil':
        newElement = {
          id,
          type: 'line',
          points: [x, y, x, y],
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          x: x, 
          y: y,
        };
        break;
      case 'rectangle':
        newElement = {
          id,
          type: 'rectangle',
          x: x,
          y: y,
          width: 0,
          height: 0,
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          fill: 'transparent' 
        };
        break;
      case 'text':
        newElement = {
          id,
          type: 'text',
          x: x,
          y: y,
          text: 'New Text',
          fontSize: 20 / viewport.scale, 
          fill: strokeColor,
        };
        if (newElement) {
          addElement(newElement);
          setIsDrawing(false);
          setTimeout(() => handleTextDblClick(id), 50);
        }
        return; 
      default:
        setIsDrawing(false);
        return;
    }

    if (newElement) {
      addElement(newElement);
      setSelectedIds(new Set([id])); 
    }
  }, [currentTool, viewport, strokeColor, strokeWidth, addElement, setSelectedIds, handleElementClick, elements]); 

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

  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    const scaleBy = 1.1;
    const stage = stageRef.current; 
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScaleUnclamped = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    const newScale = Math.max(0.1, Math.min(newScaleUnclamped, 10)); 

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    setViewport({ x: newPos.x, y: newPos.y, scale: newScale });
  }, [setViewport]); 

  const handleStageDragMove = useCallback((e: KonvaEventObject<DragEvent>) => {
    if (currentTool !== 'pan') return;
    const stage = e.target as Konva.Stage;
    setViewport({ x: stage.x(), y: stage.y(), scale: viewport.scale });
  }, [currentTool, viewport.scale, setViewport]); 
  
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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onDragMove={handleStageDragMove}
        draggable={currentTool === 'pan'}
      >
        <Layer>
          {/* Render image elements */}
          {elementsArray
            .filter((entry): entry is [string, ImageElement] => entry[1].type === 'image')
            .map(([id, element]) => (
              <AIGeneratedImage
                key={id}
                element={element} 
                isSelected={selectedIds.has(id)}
                onSelect={() => handleElementClick(id)}
                onDragEnd={(e) => handleElementDragEnd(id, e)}
                onTransformEnd={(e) => handleTransformEnd(id, e)}
                viewportScale={viewport.scale}
              />
            ))}

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
        <div className="text-xs">Zoom: {Math.round(viewport.scale * 100)}%</div>
        <button
          className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
          onClick={() => {
            const stage = stageRef.current;
            if (!stage) return;
            const scaleBy = 1.1;
            const oldScale = stage.scaleX();
            const center = { x: stage.width() / 2, y: stage.height() / 2 };
            const relatedTo = { 
              x: (center.x - stage.x()) / oldScale,
              y: (center.y - stage.y()) / oldScale,
            };
            const newScale = Math.min(10, oldScale * scaleBy); 
            const newPos = {
              x: center.x - relatedTo.x * newScale,
              y: center.y - relatedTo.y * newScale,
            };
            setViewport({ ...newPos, scale: newScale });
          }}
        >
          +
        </button>
        <button
          className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
          onClick={() => {
            const stage = stageRef.current;
            if (!stage) return;
            const scaleBy = 1.1;
            const oldScale = stage.scaleX();
            const center = { x: stage.width() / 2, y: stage.height() / 2 };
             const relatedTo = { 
              x: (center.x - stage.x()) / oldScale,
              y: (center.y - stage.y()) / oldScale,
            };
            const newScale = Math.max(0.1, oldScale / scaleBy); 
            const newPos = {
              x: center.x - relatedTo.x * newScale,
              y: center.y - relatedTo.y * newScale,
            };
            setViewport({ ...newPos, scale: newScale });
          }}
        >
          -
        </button>
        <button
          className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
          onClick={() => setViewport({ x: 0, y: 0, scale: 1 })}
        >
          Reset View
        </button>
      </div>
    </div>
  );
};

export default SimpleCanvas;
