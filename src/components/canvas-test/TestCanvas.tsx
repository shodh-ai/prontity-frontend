'use client';

import React, { useState } from 'react';
import { Stage, Layer, Rect, Circle, Text } from 'react-konva';
import Konva from 'konva';

const TestCanvas: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  
  return (
    <Stage width={window.innerWidth * 0.8} height={480}>
      <Layer>
        {/* Simple Rectangle */}
        <Rect
          x={50}
          y={50}
          width={100}
          height={100}
          fill="red"
          shadowBlur={10}
          draggable
          onDragStart={() => setIsDragging(true)}
          onDragEnd={() => setIsDragging(false)}
        />
        
        {/* Circle */}
        <Circle 
          x={200} 
          y={100} 
          radius={50} 
          fill="green" 
          draggable 
          onDragStart={() => setIsDragging(true)}
          onDragEnd={() => setIsDragging(false)}
        />
        
        {/* Text */}
        <Text
          x={300}
          y={80}
          text="Drag these shapes"
          fontSize={20}
          fontFamily="Arial"
          fill="black"
        />
        
        {/* Status text */}
        <Text
          x={50}
          y={200}
          text={`Status: ${isDragging ? 'Dragging' : 'Idle'}`}
          fontSize={16}
          fontFamily="Arial"
          fill="blue"
        />
        
        {/* Info about React Konva */}
        <Text
          x={50}
          y={240}
          text="React Konva is working correctly!"
          fontSize={18}
          fontFamily="Arial"
          fill="green"
          fontStyle="bold"
        />
      </Layer>
    </Stage>
  );
};

export default TestCanvas;
