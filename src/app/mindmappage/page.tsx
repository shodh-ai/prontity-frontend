"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Separator } from "@/components/ui/separator";

// Dynamically import the MindMapComponent with SSR disabled
const MindMapComponent = dynamic(() => import('./MindMapComponent').then(mod => ({ default: mod.MindMapComponent })), {
  ssr: false, // Disable server-side rendering
  loading: () => <div className="flex items-center justify-center h-full">Loading component...</div>
});

export default function MindMapPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="bg-gradient-to-r from-indigo-600 to-blue-500 p-6 rounded-lg shadow-lg mb-8">
        <h1 className="text-3xl font-bold mb-3 text-white">Learning Mind Map</h1>
        <p className="mb-2 text-white/90">
          Generate a mind map to help with coherence in writing and speaking.
          The AI-powered visualization organizes ideas in a structured format.
        </p>
      </div>
      
      <Separator className="my-6" />
      
      {/* Our refactored MindMap component handles all the UI and functionality */}
      <MindMapComponent 
        showDebugInfo={true}
        width={900}
        height={600}
        apiEndpoint="/api/generate-mindmap"
      />
    </div>
  );
}
