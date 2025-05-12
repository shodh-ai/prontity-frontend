import React from 'react';
import dynamic from 'next/dynamic';

// Import the client component with SSR disabled to avoid hydration errors
const AssemblyAIClient = dynamic(
  () => import('./AssemblyAIClient'),
  { ssr: false }
);

export default function AssemblyAIPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Real-time Transcription with AssemblyAI</h1>
      <AssemblyAIClient />
    </div>
  );
}
