/**
 * Utility functions to help with localStorage optimization and management
 */

/**
 * Compresses image data in a canvas state object to reduce localStorage usage.
 * This function will resize/compress any large image URLs in the canvas elements.
 */
export function optimizeCanvasDataForStorage(canvasData: any[]): any[] {
  return canvasData.map(element => {
    // Clone the element to avoid modifying the original
    const optimizedElement = { ...element };
    
    // If it's an image element with a data URL
    if (element.type === 'image' && typeof element.url === 'string' && element.url.startsWith('data:image')) {
      // Replace with a compressed version
      optimizedElement.url = compressImageDataUrl(element.url, 0.7, 800); // 70% quality, max 800px
    }
    
    // Also check metadata for image data
    if (element.metadata) {
      const newMetadata = { ...element.metadata };
      
      // Check for originalImage in metadata (often holds a base64 image)
      if (typeof newMetadata.originalImage === 'string' && newMetadata.originalImage.startsWith('data:image')) {
        newMetadata.originalImage = compressImageDataUrl(newMetadata.originalImage, 0.6, 400); // More aggressive compression for metadata
      }
      
      optimizedElement.metadata = newMetadata;
    }
    
    return optimizedElement;
  });
}

/**
 * Compresses a data URL image by resizing and reducing quality.
 * @param dataUrl The original data URL
 * @param quality Quality factor (0-1)
 * @param maxDimension Maximum width or height
 * @returns Compressed data URL
 */
export function compressImageDataUrl(dataUrl: string, quality = 0.8, maxDimension = 1024): string {
  try {
    // If the data URL is already small, don't process it
    if (dataUrl.length < 10000) {
      return dataUrl;
    }
    
    // Create temporary image and canvas in memory
    const img = document.createElement('img');
    img.src = dataUrl;
    
    // Create a canvas element to draw the resized image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.warn('Unable to get canvas context for compression');
      return dataUrl;
    }
    
    // Calculate new dimensions while maintaining aspect ratio
    let width = img.width;
    let height = img.height;
    
    if (width > height && width > maxDimension) {
      height = Math.round(height * maxDimension / width);
      width = maxDimension;
    } else if (height > maxDimension) {
      width = Math.round(width * maxDimension / height);
      height = maxDimension;
    }
    
    // Set canvas size to the new dimensions
    canvas.width = width;
    canvas.height = height;
    
    // Draw the resized image on the canvas
    ctx.drawImage(img, 0, 0, width, height);
    
    // Convert to compressed data URL
    return canvas.toDataURL('image/jpeg', quality);
  } catch (error) {
    console.error('Error compressing image:', error);
    // Return original if compression fails
    return dataUrl;
  }
}

/**
 * Safely stores data in localStorage with size checks
 * @param key localStorage key
 * @param data Data to store
 * @returns true if successful, false if failed
 */
export function safeLocalStorage(key: string, data: string): boolean {
  try {
    // Check data size
    const sizeInMB = data.length * 2 / 1024 / 1024; // Rough estimation of string size in MB
    
    if (sizeInMB > 4) {
      console.warn(`Data for ${key} is very large (${sizeInMB.toFixed(2)}MB), may exceed localStorage limits`);
    }
    
    // Try to store it
    localStorage.setItem(key, data);
    return true;
  } catch (error) {
    console.error(`Failed to save data to localStorage for key ${key}:`, error);
    return false;
  }
}

/**
 * Estimate the current localStorage usage as a percentage of available space
 * This is approximate since browsers don't expose exact quota information
 */
export function estimateLocalStorageUsage(): number {
  try {
    // Get all keys
    const keys = Object.keys(localStorage);
    let totalSize = 0;
    
    // Calculate total size of all items
    keys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        totalSize += key.length + value.length;
      }
    });
    
    // Convert to MB (approximate)
    const sizeInMB = totalSize * 2 / 1024 / 1024;
    
    // Estimate quota (most browsers have 5-10MB)
    const estimatedQuota = 5; // Conservative estimate in MB
    
    // Return as percentage
    return Math.min(100, (sizeInMB / estimatedQuota) * 100);
  } catch (error) {
    console.error('Error estimating localStorage usage:', error);
    return 0;
  }
}
