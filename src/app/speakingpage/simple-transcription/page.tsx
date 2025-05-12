import React from 'react';
import dynamic from 'next/dynamic';

// Use dynamic import with ssr: false to avoid hydration errors
const SimpleTranscriptionClient = dynamic(
  () => import('./SimpleTranscriptionClient'),
  { ssr: false }
);

export default function SimpleTranscriptionPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <SimpleTranscriptionClient />
    </div>
  );
}
