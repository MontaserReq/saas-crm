import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { applySecurityHeaders, getConfiguredOrigin } from '@/lib/security/web';

function relativeRedirect(path: string, request: NextRequest): NextResponse {
  const response = new NextResponse(null, { status: 307, headers: { Location: path } });
  return applySecurityHeaders(response, request);
}

export function authRedirect(path: string, request: NextRequest): NextResponse {
  const origin = getConfiguredOrigin();
  if (!origin) return relativeRedirect(path, request);
  return applySecurityHeaders(NextResponse.redirect(new URL(path, origin)), request);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('codeline_session')?.value;

  const isAuthPage = pathname.startsWith('/login');
  const isPublicPage = pathname === '/' || pathname === '/pricing' || pathname.startsWith('/legal') || pathname.startsWith('/onboarding') || pathname.startsWith('/public-search') || pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password');
  // Public branding assets are required by the login page before a session
  // exists. If they pass through the auth redirect, the browser receives the
  // login HTML instead of the SVG/PNG and renders a broken image.
  const isApiAuthOrAttachment = pathname.startsWith('/api/') || pathname.startsWith('/_next') || pathname.startsWith('/branding/') || pathname.includes('/favicon.ico');

  if (isApiAuthOrAttachment) {
    return applySecurityHeaders(NextResponse.next(), request);
  }

  // The login layout validates the session before redirecting. Cookie presence
  // alone also includes expired and revoked sessions, which must reach login.

  // If user is accessing protected dashboard page without session cookie
  if (!isAuthPage && !isPublicPage && !token) {
    return authRedirect('/login', request);
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
