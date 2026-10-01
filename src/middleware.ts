import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { applySecurityHeaders, getConfiguredOrigin } from '@/lib/security/web';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('codeline_session')?.value;

  const isAuthPage = pathname.startsWith('/login');
  const isPublicPage = pathname.startsWith('/public-search') || pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password');
  const isApiAuthOrAttachment = pathname.startsWith('/api/') || pathname.startsWith('/_next') || pathname.includes('/favicon.ico');

  if (isApiAuthOrAttachment) {
    return applySecurityHeaders(NextResponse.next(), request);
  }

  // If user is accessing login page while already possessing session cookie
  if (isAuthPage && token) {
    const origin = getConfiguredOrigin();
    return applySecurityHeaders(NextResponse.redirect(origin ? new URL('/', origin) : new URL('/', request.url)), request);
  }

  // If user is accessing protected dashboard page without session cookie
  if (!isAuthPage && !isPublicPage && !token) {
    const origin = getConfiguredOrigin();
    const loginUrl = origin ? new URL('/login', origin) : new URL('/login', request.url);
    return applySecurityHeaders(NextResponse.redirect(loginUrl), request);
  }

  return applySecurityHeaders(NextResponse.next(), request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
