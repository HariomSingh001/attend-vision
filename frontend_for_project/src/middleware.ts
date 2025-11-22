import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check if user is authenticated
  const authenticated = request.cookies.get('authenticated');
  
  // Allow access to public routes (no auth required)
  const publicRoutes = [
    '/login',
    '/signup',
    '/forgot-password',
    '/_next',
    '/api',
  ];
  
  const isPublicRoute = publicRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  );
  
  // If it's a public route, allow access
  if (isPublicRoute) {
    return NextResponse.next();
  }
  
  // If user is authenticated, allow access to protected routes
  if (authenticated) {
    return NextResponse.next();
  }
  
  // Redirect to login if not authenticated and trying to access protected route
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
