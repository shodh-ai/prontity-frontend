'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { fetchUserProfile, User } from '@/api/pronityClient';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  
  useEffect(() => {
    // Check if token exists in localStorage
    const token = localStorage.getItem('token');
    if (token) {
      fetchUserProfile(token)
        .then(userData => {
          setIsAuthenticated(true);
          setUser(userData);
        })
        .catch((error) => {
          // Token invalid or expired
          console.error('Token validation error:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setIsAuthenticated(false);
          setUser(null);
        });
    }
  }, []);
  
  const logout = () => {
    // Remove token and user data from localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    router.push('/loginpage');
  };
  
  const isActive = (path: string) => {
    return pathname === path ? 'bg-blue-700' : '';
  };

  return (
    <nav className="bg-blue-600 text-white p-4">
      <div className="container mx-auto flex flex-wrap items-center justify-between">
        <Link href="/rox" className="font-semibold text-xl">Language Learning</Link>
        
        <div className="flex space-x-4 items-center">
          {isAuthenticated ? (
            <>
              <Link 
                href="/flow" 
                className={`px-3 py-2 rounded hover:bg-blue-700 ${isActive('/flow')}`}
              >
                Learning Flow
              </Link>
              <Link 
                href="/interestspage" 
                className={`px-3 py-2 rounded hover:bg-blue-700 ${isActive('/interestspage')}`}
              >
                Interests
              </Link>
              <Link 
                href="/vocabpage" 
                className={`px-3 py-2 rounded hover:bg-blue-700 ${isActive('/vocabpage')}`}
              >
                Vocabulary
              </Link>
              <Link 
                href="/speakingpage" 
                className={`px-3 py-2 rounded hover:bg-blue-700 ${isActive('/speakingpage')}`}
              >
                Speaking
              </Link>
              <Link 
                href="/writingpage_tiptap" 
                className={`px-3 py-2 rounded hover:bg-blue-700 ${isActive('/writingpage_tiptap')}`}
              >
                Writing
              </Link>
              <Link 
                href="/profilepage" 
                className={`px-3 py-2 rounded hover:bg-blue-700 ${isActive('/profilepage')}`}
              >
                Profile
              </Link>
              <button 
                onClick={logout}
                className="px-3 py-2 bg-red-600 rounded hover:bg-red-700 ml-4"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link 
                href="/loginpage" 
                className={`px-3 py-2 rounded hover:bg-blue-700 ${isActive('/loginpage')}`}
              >
                Login
              </Link>
              <Link 
                href="/signuppage" 
                className={`px-3 py-2 rounded hover:bg-blue-700 ${isActive('/signuppage')}`}
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
