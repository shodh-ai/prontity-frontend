/**
 * Shared type definitions for the Vocabulary Canvas Service
 */

// Drawing element type
export interface DrawingElement {
  id: string; // Unique ID (UUID)
  type: 'path' | 'rect' | 'image' | 'text'; // Element type
  x: number; // World coordinate X
  y: number; // World coordinate Y
  rotation?: number; // Rotation in degrees (optional)
  // Bounding box/size might be derived or stored
  width?: number; // For image, rect, text
  height?: number; // For image, rect, text
  // Other common properties (stroke, fill, etc.)
  strokeColor?: string;
  strokeWidth?: number;
  fillColor?: string;
  opacity?: number;
  // Type-specific properties
  points?: number[]; // For PathElement
  src?: string; // For ImageElement
  text?: string; // For TextElement
  fontSize?: number; // For TextElement
  fontFamily?: string; // For TextElement
  color?: string; // For TextElement color
}

// The CanvasState as received from the frontend (Map converted to Array for POST body)
export type CanvasStatePayload = DrawingElement[];

// How the data will be stored in the database (JSON array)
// (Matches CanvasStatePayload structure)
export type StoredCanvasData = DrawingElement[];

// Service responses
export interface ServiceResponse {
  status: string;
  message?: string;
}
