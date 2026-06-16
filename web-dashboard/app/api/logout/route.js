import { NextResponse } from 'next/server';

export function GET() {
  const res = NextResponse.redirect(new URL('/login', 'https://example.com'));
  // Clear auth cookies
  res.cookies.set('df_auth', '', { path: '/', maxAge: 0 });
  res.cookies.set('df_auth_v2', '', { path: '/', maxAge: 0 });
  return res;
}
