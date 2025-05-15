'use client';

import React, { useState, useEffect } from 'react';

interface VocabImageOverlayProps {
  // No props needed for now
}

/**
 * A component that displays images directly in a fullscreen overlay
 * This bypasses the canvas system entirely to ensure images are visible
 */
const VocabImageOverlay: React.FC<VocabImageOverlayProps> = () => {
  const [images, setImages] = useState<string[]>([]);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  
  // Subscribe to a custom event for receiving images
  useEffect(() => {
    const handleImageEvent = (event: CustomEvent) => {
      const imageUrl = event.detail.imageUrl;
      console.log('VocabImageOverlay received image:', imageUrl.substring(0, 50) + '...');
      
      // Add to image history
      setImages(prev => [...prev, imageUrl]);
      
      // Set as current image
      setCurrentImage(imageUrl);
      
      // Show the overlay
      setShowOverlay(true);
    };
    
    // Add event listener for custom image event
    window.addEventListener('vocab-image-generated' as any, handleImageEvent as any);
    
    // Clean up
    return () => {
      window.removeEventListener('vocab-image-generated' as any, handleImageEvent as any);
    };
  }, []);
  
  // Close overlay after clicking anywhere
  const handleClose = () => {
    setShowOverlay(false);
  };
  
  if (!showOverlay || !currentImage) {
    return (
      <div 
        style={{ 
          position: 'fixed', 
          bottom: '20px', 
          right: '20px',
          zIndex: 9998,
          background: 'rgba(86, 111, 233, 0.9)',
          color: 'white',
          padding: '10px 15px',
          borderRadius: '30px',
          fontSize: '14px',
          cursor: 'pointer',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}
        onClick={() => setShowOverlay(true)}
      >
        {images.length > 0 ? `${images.length} images available` : 'No images yet'}
      </div>
    );
  }
  
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        padding: '20px',
        overflow: 'hidden'
      }}
      onClick={handleClose}
    >
      <div 
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          color: 'white',
          fontSize: '24px',
          cursor: 'pointer',
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
        onClick={handleClose}
      >
        ✕
      </div>
      
      <img 
        src={currentImage} 
        alt="Vocabulary visualization" 
        style={{
          maxWidth: '80%',
          maxHeight: '80%',
          borderRadius: '10px',
          boxShadow: '0 5px 15px rgba(0,0,0,0.5)'
        }}
      />
      
      <div 
        style={{
          marginTop: '20px',
          color: 'white',
          textAlign: 'center',
          maxWidth: '600px'
        }}
      >
        <p>Click anywhere to close</p>
        <p style={{ fontSize: '14px', opacity: 0.8, marginTop: '5px' }}>
          Image {images.indexOf(currentImage) + 1} of {images.length}
        </p>
      </div>
    </div>
  );
};

export default VocabImageOverlay;
