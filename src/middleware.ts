import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Temporarily make all paths accessible without login
// Original list: ['/loginpage', '/signuppage', '/api', '/roxpage/direct']
const publicPaths = ['/']; // This effectively makes all paths public since all paths start with '/'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if the path is public
  // Currently all paths will be considered public
  const isPublicPath = publicPaths.some(path => 
    pathname.startsWith(path) || pathname === '/'
  );
  
  // Check if user is authenticated
  const token = await getToken({ 
    req: request, 
    secret: process.env.NEXTAUTH_SECRET 
  });
  
  // This block is currently inactive since all paths are public
  if (!isPublicPath && !token) {
    const url = new URL('/loginpage', request.url);
    url.searchParams.set('callbackUrl', encodeURI(request.url));
    return NextResponse.redirect(url);
  }
  
  // If the user is authenticated and trying to access login/signup page,
  // redirect to main page (keeps this behavior active)
  if ((pathname.startsWith('/loginpage') || pathname.startsWith('/signuppage')) && token) {
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