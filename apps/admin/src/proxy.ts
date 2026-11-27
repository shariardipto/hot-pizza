import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';

/** Fast redirect to /login when there is no session cookie (the API still checks every request). */
export function proxy(req: NextRequest) {
  const cookie = getSessionCookie(req, { cookiePrefix: 'admin' });
  if (!cookie) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!login|reset-password|api|uploads|_next|favicon.ico|.*\\..*).*)'],
};
