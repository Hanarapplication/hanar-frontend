import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/@')) {
    const username = pathname.slice(2);
    if (username) {
      const url = req.nextUrl.clone();
      url.pathname = `/profile/${username}`;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/@:path*'],
};
