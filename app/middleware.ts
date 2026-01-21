import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware runs before rendering any page
export function middleware(req: NextRequest) {
  const role = req.cookies.get('adminRole')?.value; // Get the adminRole cookie
  const url = req.nextUrl.clone(); // Clone the current URL

  // If user tries to access /admin/owner and is not an owner, redirect to /unauthorized
  if (url.pathname.startsWith('/admin/owner') && role !== 'owner') {
    url.pathname = '/unauthorized';
    return NextResponse.redirect(url);
  }

  // Allow the request to continue
  return NextResponse.next();
}

// Apply this middleware only to /admin/owner and its subroutes
export const config = {
  matcher: ['/admin/owner/:path*'],
};
