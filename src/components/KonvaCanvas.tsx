import React from 'react';
import { Stage, Layer, Rect } from 'react-konva';

interface KonvaCanvasProps {
  width?: number;
  height?: number;
}

const KonvaCanvas: React.FC<KonvaCanvasProps> = ({ width = 800, height = 600 }) => {
  return (
    <Stage width={width} height={height}>
      <Layer>
        <Rect
          x={20}
          y={20}
          width={100}
          height={100}
          fill="red"
          draggable
        />
      </Layer>
    </Stage>
  );
};

export default KonvaCanvas;
