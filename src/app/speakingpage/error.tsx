'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SpeakingPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Speaking page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8 bg-white shadow-lg rounded-lg max-w-md">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Speaking Test Error</h2>
        <p className="text-gray-600 mb-6">
          We encountered an issue with the speaking test. This might be related to audio processing or server connectivity.
        </p>
        <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3 justify-center">
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 focus:outline-none"
          >
            Try again
          </button>
          <button
            onClick={() => router.push('/speakingpage')}
            className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 focus:outline-none"
          >
            Go back to speaking tests
          </button>
        </div>
      </div>
    </div>
  );
}
