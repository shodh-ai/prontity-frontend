'use client';

import React, { useState, useEffect } from 'react';
import { Image, Transformer } from 'react-konva';
import useImage from 'use-image';
import { DrawingElement, ImageElement } from '@/state/canvasStore';
import { KonvaEventObject } from 'konva/lib/Node';

interface AIGeneratedImageProps {
  element: ImageElement;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
  onTransformEnd: (e: KonvaEventObject<Event>) => void;
  viewportScale: number;
  onEdit?: (element: ImageElement, newImageData: string, prompt: string) => Promise<void>;
}

const AIGeneratedImage = ({
  element,
  isSelected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  viewportScale,
  onEdit,
}: AIGeneratedImageProps) => {
  const imageRef = React.useRef<any>(null);
  const trRef = React.useRef<any>(null);
  
  // Get the image URL from the element
  const imageSource = element.imageUrl;
  console.log('AIGeneratedImage: Attempting to load image from source:', imageSource);
  
  // Check if the image source is a data URI
  if (typeof imageSource === 'string' && imageSource.startsWith('data:')) {
    console.log('AIGeneratedImage: Source is a data URI with first 50 chars:', imageSource.substring(0, 50) + '...');
  }
  
  const [image, status] = useImage(imageSource as string, 'anonymous');
  const [imageLoaded, setImageLoaded] = useState(false);

  // Effect for transformer
  useEffect(() => {
    if (isSelected && imageRef.current && trRef.current) {
      // Attach transformer to the image
      trRef.current.nodes([imageRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  // Handle image load
  useEffect(() => {
    console.log('AIGeneratedImage: image load status:', status);
    console.log('AIGeneratedImage: element details:', element);
    
    if (image) {
      setImageLoaded(true);
      console.log('AIGeneratedImage: image loaded successfully with dimensions:', {
        naturalWidth: image.naturalWidth, 
        naturalHeight: image.naturalHeight
      });
    } else {
      console.log('AIGeneratedImage: image failed to load');
    }
  }, [image, status, element]);

  // Simplified double-click handler that delegates to parent's onEdit
  const handleDblClick = (e: KonvaEventObject<MouseEvent>) => {
    if (onEdit && imageLoaded) {
      // Just call the parent's onEdit function which now uses a separate modal
      onEdit(element, "", "");
    }
  };

  return (
    <>
      <Image
        ref={imageRef}
        image={image}
        x={element.x as number}
        y={element.y as number}
        width={element.width as number}
        height={element.height as number}
        draggable={isSelected}
        onClick={onSelect}
        onTap={onSelect}
        onDblClick={handleDblClick}
        onDragEnd={onDragEnd}
        onTransformEnd={onTransformEnd}
        id={element.id}
      />
      {isSelected && imageLoaded && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            // Minimum size constraints
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            return newBox;
          }}
          anchorStroke="#566FE9"
          anchorFill="#ffffff"
          anchorSize={8 / viewportScale}
          borderStroke="#566FE9"
          borderStrokeWidth={1 / viewportScale}
          anchorCornerRadius={4}
        />
      )}
    </>
  );
};

export default AIGeneratedImage;
