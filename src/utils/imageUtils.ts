/**
 * Utility functions for handling image data conversions and processing
 */

/**
 * Converts a canvas to a base64 data URL with optional background color
 * @param canvas - The canvas element to convert
 * @param backgroundColor - Optional background color (defaults to white)
 * @returns A base64 data URL of the canvas content
 */
export function canvasToBase64(
  canvas: HTMLCanvasElement,
  backgroundColor: string = '#FFFFFF'
): string {
  // Create a temporary canvas to ensure we have a white background
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  
  if (!tempCtx) {
    return '';
  }
  
  // Fill with specified background color
  tempCtx.fillStyle = backgroundColor;
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  
  // Draw the original canvas content on top
  tempCtx.drawImage(canvas, 0, 0);
  
  // Return as data URL
  return tempCanvas.toDataURL('image/png');
}

/**
 * Splits a data URL into mime type and raw base64 data
 * @param dataUrl - The data URL to split
 * @returns An object with mimeType and data properties
 */
export function splitDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return { mimeType: 'image/png', data: '' };
  }
  return {
    mimeType: matches[1],
    data: matches[2]
  };
}

/**
 * Loads an image from a URL and draws it onto a canvas
 * @param canvas - The canvas to draw the image onto
 * @param imageUrl - The URL of the image to load
 * @returns A promise that resolves when the image is loaded and drawn
 */
export function loadImageToCanvas(
  canvas: HTMLCanvasElement,
  imageUrl: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      // Clear canvas
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw the image, maintaining aspect ratio
      const scale = Math.min(
        canvas.width / img.width, 
        canvas.height / img.height
      );
      
      const centerX = (canvas.width - img.width * scale) / 2;
      const centerY = (canvas.height - img.height * scale) / 2;
      
      ctx.drawImage(
        img,
        0, 0, img.width, img.height,
        centerX, centerY, img.width * scale, img.height * scale
      );
      
      resolve();
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageUrl;
  });
}
