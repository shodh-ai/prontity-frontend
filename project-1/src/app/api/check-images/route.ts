import { NextResponse } from 'next/server';

// Type definitions
interface ImageRecord {
  id: string;
  word: string;
  prompt: string;
  imageData: string;
  timestamp: number; // When the image was added to the queue
  status: 'pending' | 'delivered' | 'acknowledged';
  deliveredAt?: number; // When the image was first delivered to a client
  deliveryCount: number; // How many times this image has been delivered
}

// In-memory image store with improved tracking
// Each image has a unique ID and status tracking
const imageStore: Map<string, ImageRecord> = new Map();

// Image records sorted by creation time to maintain order
let imageQueue: string[] = [];

// Track acknowledged images for 5 minutes to avoid duplicates
const acknowledgedImages: Set<string> = new Set();

// API route to add an image (handles POST requests)
export async function POST(request: Request) {
  try {
    const { word, prompt, imageData } = await request.json();

    if (!word || !prompt || !imageData) {
      return NextResponse.json({ success: false, error: 'Missing word, prompt, or imageData' }, { status: 400 });
    }
  // Generate a unique ID for the image
  const id = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  // Create the image record
  const imageRecord: ImageRecord = {
    id,
    word,
    prompt,
    imageData,
    timestamp: Date.now(),
    status: 'pending',
    deliveryCount: 0
  };
  
  // Add to our stores
  imageStore.set(id, imageRecord);
  imageQueue.push(id);
  
  console.log(`Added image for word "${word}" to queue with ID: ${id}`);
  return NextResponse.json({ success: true, imageId: id, message: 'Image added successfully' });
  } catch (error) {
    console.error('Error in POST /api/check-images:', error);
    return NextResponse.json({ success: false, error: 'Failed to add image' }, { status: 500 });
  }
}

// API route to check for new images
export async function GET(request: Request) {
  try {
    // Extract query parameters
    const url = new URL(request.url);
    const ackIds = url.searchParams.get('ack')?.split(',') || [];
    const clientId = url.searchParams.get('clientId') || 'anonymous';
    
    // Process acknowledgements first
    if (ackIds.length > 0) {
      ackIds.forEach(id => {
        if (imageStore.has(id)) {
          // Mark as acknowledged and update the record
          const image = imageStore.get(id)!;
          image.status = 'acknowledged';
          imageStore.set(id, image);
          
          // Add to acknowledged set for duplicate prevention
          acknowledgedImages.add(id);
          
          console.log(`Image ${id} acknowledged by client ${clientId}`);
          
          // Schedule cleanup of this image record after 5 minutes
          setTimeout(() => {
            imageStore.delete(id);
            acknowledgedImages.delete(id);
          }, 5 * 60 * 1000);
        }
      });
    }
    
    // Get pending images (not yet delivered or delivered < 3 times and not yet acknowledged)
    const pendingImages = imageQueue
      .map(id => imageStore.get(id))
      .filter(img => img && (
        img.status === 'pending' || 
        (img.status === 'delivered' && img.deliveryCount < 3)
      ))
      .slice(0, 5); // Limit to 5 images per request
    
    // Update status of returned images
    const currentTime = Date.now();
    const returnedImages = pendingImages.map(img => {
      if (!img) return null;
      
      // Update the image record
      img.status = 'delivered';
      img.deliveredAt = currentTime;
      img.deliveryCount += 1;
      imageStore.set(img.id, img);
      
      // Return the image data to the client
      return {
        id: img.id,
        word: img.word,
        prompt: img.prompt,
        imageData: img.imageData,
        timestamp: img.timestamp
      };
    }).filter(Boolean);
    
    // Clean up the queue periodically
    // Remove IDs from queue where the image is acknowledged or delivery count > 3
    if (Math.random() < 0.1) { // 10% chance to clean up on each request
      imageQueue = imageQueue.filter(id => {
        const img = imageStore.get(id);
        return img && img.status !== 'acknowledged' && img.deliveryCount < 3;
      });
    }
    
    // If there are images, log how many were returned
    if (returnedImages.length > 0) {
      console.log(`Returning ${returnedImages.length} pending images to client ${clientId}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      images: returnedImages,
      pendingCount: imageQueue.length
    });
  } catch (error) {
    console.error('Error in check-images API:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      images: []
    }, { status: 500 });
  }
}
