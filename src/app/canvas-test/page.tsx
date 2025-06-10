'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import type { VaraTextObject, VaraOptions } from '@/components/VaraText';

// Dynamically import the KonvaCanvas component with SSR turned off
const KonvaCanvasNoSSR = dynamic(
  () => import('@/components/KonvaCanvas'),
  { ssr: false }
);

// Dynamically import the VaraText component with SSR turned off
const VaraTextNoSSR = dynamic(
  () => import('@/components/VaraText'),
  { ssr: false }
);

const CanvasTestPage = () => {
  const varaFontUrl = "https://cdn.jsdelivr.net/gh/akzhy/Vara/fonts/Satisfy/SatisfySL.json";
  const varaTexts: VaraTextObject[] = [
    {
      text: "Hello Konva!",
      fontSize: 48,
      strokeWidth: 1.5,
      color: "navy",
      textAlign: "center",
      duration: 2000,
      id: "konva-overlay-text", // Optional: for specific styling or targeting
    },
  ];

  const varaOptions: VaraOptions = {
    fontSize: 48, // Default for texts if not specified individually
    strokeWidth: 1.5,
    color: "navy",
    autoAnimation: true,
    queued: true,
    letterSpacing: 2,
  };

  // Define canvas dimensions - these should match or be considered by Vara positioning
  const canvasWidth = 800;
  const canvasHeight = 600;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-4xl">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-4 text-center">
          Konva Canvas with Vara.js Text Overlay
        </h1>
        <p className="text-gray-600 mb-6 text-center">
          Interactive Konva canvas with animated text overlay.
        </p>
        {/* Wrapper for Konva and Vara for positioning */}
        <div 
          className="relative border-2 border-blue-300 rounded-lg shadow-lg overflow-hidden mx-auto"
          style={{ width: canvasWidth, height: canvasHeight }} // Set explicit size for the container
        >
          {/* Konva Canvas */}
          <div className="absolute top-0 left-0 w-full h-full">
            <KonvaCanvasNoSSR width={canvasWidth} height={canvasHeight} />
          </div>

          {/* Vara Text Overlay */}
          {/* We position VaraText absolutely within the relative parent.
              The text inside Vara will be centered by its own textAlign.
              Adjust top/left/transform for precise centering of the Vara container itself if needed.
          */}
          <div 
            className="absolute top-0 left-0 w-full h-full flex items-center justify-center"
            style={{ pointerEvents: 'none' }} // Allows clicks to pass through to Konva if needed
          >
            <VaraTextNoSSR
              fontJsonUrl={varaFontUrl}
              texts={varaTexts}
              options={varaOptions}
              containerId="vara-on-konva" // Unique ID for this Vara instance
              // The VaraText component itself creates a div. We style its parent here.
              // Vara's internal SVG will fill its container div.
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CanvasTestPage;

