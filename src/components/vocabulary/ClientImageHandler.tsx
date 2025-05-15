'use client';

import ImageGenerationHandler from '@/components/vocabulary/ImageGenerationHandler';
import { useState, useCallback, useEffect } from 'react';

export default function ClientImageHandler() {
  const [images, setImages] = useState<{ id: string, url: string, word: string }[]>([]);
  
  // Function to handle images received from the agent via our direct system
  const handleAgentImageReceived = useCallback((imageData: { word: string, url: string, id: string }) => {
    console.log(`Received agent-generated image for ${imageData.word}`);
    setImages(prevImages => {
      // Avoid duplicates by checking if we already have this image
      const exists = prevImages.some(img => img.url === imageData.url || 
                                     (img.word === imageData.word && img.id.includes('agent')));
      if (exists) return prevImages;
      return [...prevImages, imageData];
    });
  }, []);
  
  // Emit a custom event when we receive images so the main page can use them
  useEffect(() => {
    if (images.length > 0 && typeof window !== 'undefined') {
      const latestImage = images[images.length - 1];
      
      // Create and dispatch custom event
      const imageEvent = new CustomEvent('agent-image-generated', {
        detail: latestImage
      });
      
      window.dispatchEvent(imageEvent);
    }
  }, [images]);

  return <ImageGenerationHandler onImageGenerated={handleAgentImageReceived} />;
}
