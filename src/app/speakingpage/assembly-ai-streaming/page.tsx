import React from 'react';
import dynamic from 'next/dynamic';

// Import the client component with SSR disabled to avoid hydration errors
const AssemblyAIStreamingClient = dynamic(
  () => import('./AssemblyAIStreamingClient'),
  { ssr: false }
);

export default function AssemblyAIStreamingPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Real-time Streaming Transcription</h1>
      <p className="mb-6">Powered by AssemblyAI's WebSocket Streaming API</p>
      <AssemblyAIStreamingClient />
    </div>
  );
}
