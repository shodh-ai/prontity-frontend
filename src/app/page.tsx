"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  
  useEffect(() => {
    // Check if the user has a valid token
    const token = localStorage.getItem('token');
    if (!token) {
      // No token found, redirect to login page
      router.push('/loginpage');
    } else {
      // Token exists, redirect to roxpage
      router.push('/roxpage');
    }
  }, [router]);
  
  // Show loading state while redirecting
  return (
    <div className="flex items-center justify-center h-screen w-full">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4">Loading...</p>
      </div>
    </div>
  );
}