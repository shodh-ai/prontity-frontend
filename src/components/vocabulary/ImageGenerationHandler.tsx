'use client';

import { useEffect, useState, useRef } from 'react';

interface ImageGenerationHandlerProps {
  onImageGenerated: (imageData: { word: string, url: string, id: string }) => void;
}

interface ImageRecord {
  id: string;
  word: string;
  prompt: string;
  imageData: string;
  timestamp: number;
}

/**
 * Component that periodically polls the agent-trigger API endpoint
 * to check if any new images have been generated and triggers frontend updates
 */
export default function ImageGenerationHandler({ onImageGenerated }: ImageGenerationHandlerProps) {
  // Track which images we've already processed to avoid duplicates
  const [processedImages, setProcessedImages] = useState<Set<string>>(new Set());
  // Track images that need to be acknowledged
  const pendingAcknowledgments = useRef<string[]>([]);
  // Generate a unique client ID
  const clientId = useRef<string>(`client_${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    // Set up periodic polling for image generation
    const checkForImages = async () => {
      try {
        console.log('Checking for new images from agent...');
        
        // Include any pending acknowledgments in the request
        let url = '/api/check-images?clientId=' + clientId.current;
        if (pendingAcknowledgments.current.length > 0) {
          url += `&ack=${pendingAcknowledgments.current.join(',')}`;
          // Clear the pending acknowledgments - they're being sent now
          pendingAcknowledgments.current = [];
        }
        
        const response = await fetch(url, { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.pendingCount) {
            console.log(`Image check response: ${data.images?.length} images, ${data.pendingCount} total pending`);
          }
          
          if (data.images && data.images.length > 0) {
            // Process any new images
            console.log(`Found ${data.images.length} new images from agent!`);
            
            const newAcknowledgments: string[] = [];
            
            data.images.forEach((image: ImageRecord) => {
              // Skip already processed images
              if (processedImages.has(image.id)) {
                console.log(`Image ${image.id} already processed, skipping`);
                return;
              }
              
              console.log('Processing image for word:', image.word, 'ID:', image.id);
              
              // Add to processed set
              setProcessedImages(prev => {
                const newSet = new Set(prev);
                newSet.add(image.id);
                return newSet;
              });
              
              // Add to pending acknowledgments
              newAcknowledgments.push(image.id);
              
              // Send the image to the parent component
              onImageGenerated({
                word: image.word,
                url: `data:image/png;base64,${image.imageData}`,
                id: `agent-${image.id}`
              });
            });
            
            // Add all new acknowledgments to the pending queue
            if (newAcknowledgments.length > 0) {
              pendingAcknowledgments.current = [
                ...pendingAcknowledgments.current,
                ...newAcknowledgments
              ];
            }
          }
        } else {
          console.warn('Non-OK response from image check:', response.status);
        }
      } catch (error) {
        console.error('Error checking for new images:', error);
      }
    };
    
    console.log(`ImageGenerationHandler mounted, setting up polling with client ID: ${clientId.current}`);
    
    // Poll every 2 seconds
    const intervalId = setInterval(checkForImages, 2000);
    checkForImages(); // Check immediately on mount
    
    // Clean up function
    return () => {
      console.log('ImageGenerationHandler unmounting, clearing interval');
      clearInterval(intervalId);
      
      // Send one final acknowledgment request if there are pending acks
      if (pendingAcknowledgments.current.length > 0) {
        const url = `/api/check-images?clientId=${clientId.current}&ack=${pendingAcknowledgments.current.join(',')}`;
        fetch(url).catch(err => console.error('Error sending final acknowledgments:', err));
      }
    };
  }, [onImageGenerated]);
  
  return null; // This component doesn't render anything
}
