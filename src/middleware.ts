import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Only these paths are accessible without login
const publicPaths = [
  '/loginpage',
  '/signuppage',
  '/api',
  '/' // Root path only, not all paths that start with '/'
];

// For debugging
const DEBUG = true;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Log the current path and authentication data in development
  if (DEBUG) {
    console.log('Middleware checking path:', pathname);
  }
  
  // Check if the path is public - exact matches only for root and precise path matches for others
  const isPublicPath = publicPaths.some(path => {
    // Special handling for the API routes, which need prefix matching
    if (path === '/api' && pathname.startsWith('/api/')) {
      return true;
    }
    // For all other paths, require exact matches
    return pathname === path;
  });
  
  if (DEBUG) {
    console.log('Is public path?', isPublicPath);
  }
  
  // Always allow access to auth-related paths
  if (pathname.startsWith('/api/auth') || 
      pathname.startsWith('/_next') ||
      pathname.includes('.') || // Static files like .js, .css, etc.
      pathname === '/favicon.ico') {
    return NextResponse.next();
  }
  
  // Check if user is authenticated
  const token = await getToken({ 
    req: request, 
    secret: process.env.NEXTAUTH_SECRET 
  });
  
  if (DEBUG) {
    console.log('Auth token found?', !!token);
  }
  
  // Redirect to login if trying to access a protected route without auth
  if (!isPublicPath && !token) {
    if (DEBUG) {
      console.log('Redirecting to login page');
    }
    
    const url = new URL('/loginpage', request.url);
    url.searchParams.set('callbackUrl', encodeURI(request.url));
    return NextResponse.redirect(url);
  }
  
  // If the user explicitly wants to force login, don't redirect
  const forceLogin = request.nextUrl.searchParams.get('forceLogin') === 'true';
  
  // Only redirect from signup page if authenticated, but allow staying on login page
  if (pathname.startsWith('/signuppage') && token && !forceLogin) {
    return NextResponse.redirect(new URL('/roxpage', request.url));
  }
  
  return NextResponse.next();
}

// Configure the middleware to run on specific paths
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public directory)
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}; 