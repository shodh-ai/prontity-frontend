import dynamic from 'next/dynamic';

// Import the content component dynamically with ssr disabled
const WebSpeechEnhancedContent = dynamic(
  () => import('./page-content'),
  { ssr: false } // This prevents the component from rendering on the server
);

// Simple page component that just renders the dynamically imported content
export default function WebSpeechEnhancedPage() {
  return <WebSpeechEnhancedContent />;
}
