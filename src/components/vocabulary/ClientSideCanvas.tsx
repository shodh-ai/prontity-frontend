'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the CanvasComponent with SSR disabled
const CanvasComponent = dynamic(
  () => import('./CanvasComponent'),
  { ssr: false }
);

const ClientSideCanvas: React.FC = () => {
  // Add a loading state to handle the dynamic import
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // This code will only run on the client
    setIsClient(true);
  }, []);

  if (!isClient) {
    // Show a loading placeholder until the client-side code is ready
    return (
      <div className="w-full h-[400px] bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-gray-500">Loading canvas...</div>
      </div>
    );
  }

  return <CanvasComponent />;
};

export default ClientSideCanvas;
