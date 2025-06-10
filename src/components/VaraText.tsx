'use client';

import React, { useEffect, useRef } from 'react';
import Vara from 'vara'; // Import Vara

export interface VaraTextObject {
  text: string;
  fontSize?: number;
  strokeWidth?: number;
  color?: string;
  id?: string | number;
  duration?: number;
  textAlign?: 'left' | 'center' | 'right';
  x?: number;
  y?: number;
  fromCurrentPosition?: {
    x?: boolean;
    y?: boolean;
  };
  autoAnimation?: boolean;
  queued?: boolean;
  delay?: number;
  letterSpacing?: number;
}

export interface VaraOptions {
  fontSize?: number;
  strokeWidth?: number;
  color?: string;
  autoAnimation?: boolean;
  queued?: boolean;
  letterSpacing?: number;
}

interface VaraTextProps {
  fontJsonUrl: string;
  texts: VaraTextObject[];
  options?: VaraOptions;
  containerId?: string; // Optional ID for the container, defaults if not provided
  containerClassName?: string;
  containerStyle?: React.CSSProperties;
}

const VaraText: React.FC<VaraTextProps> = ({
  fontJsonUrl,
  texts,
  options,
  containerId = 'vara-text-container', // Default ID
  containerClassName,
  containerStyle,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const varaInstanceRef = useRef<any>(null); // To store Vara instance

  useEffect(() => {
    // Ensure containerRef.current exists (meaning the div is rendered and has the ID)
    // and Vara is loaded, and we have texts to display.
    if (containerRef.current && typeof Vara !== 'undefined' && texts && texts.length > 0) {
      // Clear previous instance and content if any
      if (varaInstanceRef.current) {
        // Vara.js doesn't have a documented destroy method.
        // Clearing the container's innerHTML is a common workaround.
        if (containerRef.current) { // Check again as it might be null during cleanup
            containerRef.current.innerHTML = '';
        }
        varaInstanceRef.current = null;
      }

      try {
        // Use the CSS selector for the container
        varaInstanceRef.current = new Vara(
          `#${containerId}`, // Pass the CSS selector string
          fontJsonUrl,
          texts,
          options || {} // Pass empty object if options are not provided
        );
      } catch (error) {
        console.error(`Error initializing Vara.js on #${containerId}:`, error);
      }
    }

    // Cleanup function
    return () => {
      if (varaInstanceRef.current) {
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
        varaInstanceRef.current = null;
      }
    };
  }, [fontJsonUrl, texts, options, containerId]); // Re-run effect if these props change

  // Assign the id to the div element
  return <div ref={containerRef} id={containerId} className={containerClassName} style={containerStyle} />;
};

export default VaraText;
