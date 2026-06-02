import { NextResponse } from 'next/server';

export function middleware(request) {
  const { nextUrl, cookies } = request;
  const pathname = nextUrl.pathname;

  // Allow next internals, static files and api routes
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/static') || pathname.includes('.')) {
    return NextResponse.next();
  }

  const token = cookies.get('df_auth')?.value;

  if (!token && pathname !== '/login') {
    const url = nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (token && pathname === '/login') {
    const url = nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};
