'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Import Konva components with dynamic import to ensure client-side only rendering
const DynamicCanvasComponent = dynamic(
  () => import('@/components/canvas-test/TestCanvas'),
  { ssr: false }
);

export default function CanvasTestPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Canvas Test Page</h1>
      <p className="mb-4">This page tests that React Konva is working correctly with Next.js.</p>
      
      <div className="mb-4">
        <Link 
          href="/vocabpage" 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Vocabulary Page
        </Link>
      </div>
      
      <div className="w-full h-[500px] border border-gray-300 rounded-lg overflow-hidden">
        <DynamicCanvasComponent />
      </div>
    </div>
  );
}
