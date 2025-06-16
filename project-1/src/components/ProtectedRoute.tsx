"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedRoute({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  // Temporarily bypass authentication checks
  return <>{children}</>;
  
  /* Original authentication check code (commented out)
  const { data: session, status } = useSession();
  const router = useRouter();
  
  useEffect(() => {
    // If the user is not authenticated and the status is not loading
    if (status === "unauthenticated") {
      router.push("/loginpage");
    }
  }, [router, status]);
  
  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">TOEFL Practice</h1>
          <div className="animate-pulse flex space-x-4 justify-center">
            <div className="rounded-full bg-gray-300 h-3 w-3"></div>
            <div className="rounded-full bg-gray-300 h-3 w-3"></div>
            <div className="rounded-full bg-gray-300 h-3 w-3"></div>
          </div>
        </div>
      </div>
    );
  }
  
  // Render children only if authenticated
  return status === "authenticated" ? <>{children}</> : null;
  */
} 