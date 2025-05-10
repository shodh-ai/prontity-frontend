'use client';

import { useEffect, useState } from 'react';

// Simple wrapper component to only render children in browser environments
export default function BrowserOnly({ children }: { children: React.ReactNode }) {
  const [isBrowser, setIsBrowser] = useState(false);

  useEffect(() => {
    setIsBrowser(true);
  }, []);

  if (!isBrowser) {
    return null;
  }

  return <>{children}</>;
}
