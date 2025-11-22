import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check if user is authenticated
  const authenticated = request.cookies.get('authenticated');
  
  // Allow access to login page and public routes
  if (request.nextUrl.pathname.startsWith('/login') || 
      request.nextUrl.pathname === '/' ||
      request.nextUrl.pathname.startsWith('/_next') ||
      request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }
  
  // Redirect to login if not authenticated
  if (!authenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/subjects/:path*',
    '/students/:path*',
  ],
};
