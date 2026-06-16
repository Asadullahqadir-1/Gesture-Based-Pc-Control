import { NextResponse } from 'next/server';

export function middleware(request) {
  const { nextUrl, cookies } = request;
  const pathname = nextUrl.pathname;

  // Allow next internals, static files and api routes
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/static') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // Use a new cookie name to force re-login for all users.
  // Existing `df_auth` cookies will no longer grant access.
  const token = cookies.get('df_auth_v3')?.value;

  if (!token && pathname !== '/login') {
    const url = nextUrl.clone();
    url.pathname = '/login';
    const res = NextResponse.redirect(url);
    res.headers.set('x-middleware-active', '1');
    res.headers.set('x-middleware-reason', 'no-token');
    return res;
  }

  if (token && pathname === '/login') {
    const url = nextUrl.clone();
    url.pathname = '/';
    const res = NextResponse.redirect(url);
    res.headers.set('x-middleware-active', '1');
    res.headers.set('x-middleware-reason', 'already-authenticated');
    return res;
  }

  const res = NextResponse.next();
  res.headers.set('x-middleware-active', '1');
  res.headers.set('x-middleware-reason', token ? 'ok' : 'no-token-but-allowed');
  return res;
}

export const config = {
  matcher: '/:path*',
};
