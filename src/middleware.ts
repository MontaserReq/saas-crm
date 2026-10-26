import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { applySecurityHeaders, getConfiguredOrigin } from '@/lib/security/web';

const PUBLIC_HOSTS = new Set(['satrcrm.com', 'www.satrcrm.com']);
const APP_HOST = 'app.satrcrm.com';
const APP_ROUTE_PREFIXES = [
  '/activity', '/admin', '/ai-school-research', '/assignments', '/calendar',
  '/chat', '/clients', '/contacts', '/dashboard', '/deals', '/imports',
  '/leads', '/messages', '/notifications', '/pipelines', '/profile',
  '/proposals', '/schools', '/settings', '/support', '/tasks', '/tickets',
  '/todos', '/trial-expired',
];

function relativeRedirect(path: string, request: NextRequest): NextResponse {
  const response = new NextResponse(null, { status: 307, headers: { Location: path } });
  return applySecurityHeaders(response, request);
}

export function authRedirect(path: string, request: NextRequest): NextResponse {
  const origin = getConfiguredOrigin();
  if (!origin) return relativeRedirect(path, request);
  return applySecurityHeaders(NextResponse.redirect(new URL(path, origin)), request);
}

function appRedirect(request: NextRequest): NextResponse {
  const origin = getConfiguredOrigin();
  const target = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (!origin) return relativeRedirect(target, request);
  return applySecurityHeaders(NextResponse.redirect(new URL(target, origin)), request);
}

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isMarketingPath(pathname: string) {
  return pathname === '/'
    || pathname === '/en'
    || pathname.startsWith('/en/')
    || pathname === '/pricing'
    || pathname.startsWith('/legal')
    || pathname === '/sitemap.xml'
    || pathname === '/robots.txt'
    || pathname === '/manifest.webmanifest';
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Behind Caddy, Next's parsed URL can reflect the upstream container host
  // instead of the public hostname. Prefer the forwarded/Host headers so the
  // domain split remains correct in production while preserving local health
  // checks inside the container.
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const headerHost = forwardedHost || request.headers.get('host')?.trim();
  const hostname = (headerHost || request.nextUrl.hostname)
    .replace(/:\d+$/, '')
    .toLowerCase();
  const token = request.cookies.get('codeline_session')?.value;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-satrcrm-locale', pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'ar');

  const isAuthPage = pathname.startsWith('/login');
  const isAppPublicPage = pathname.startsWith('/onboarding') || pathname.startsWith('/public-search') || pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password');
  const isApiPath = pathname.startsWith('/api/');
  const isFrameworkAsset = pathname.startsWith('/_next') || pathname.startsWith('/branding/') || pathname.includes('/favicon.ico');
  const isManagedHost = PUBLIC_HOSTS.has(hostname) || hostname === APP_HOST;
  const isInternalHost = hostname === 'localhost' || hostname === '127.0.0.1';

  // Local development keeps its existing single-host behavior. In production,
  // unknown hostnames must not silently receive either the marketing site or
  // the authenticated application.
  if (process.env.NODE_ENV === 'production' && !isManagedHost && !isInternalHost) {
    return applySecurityHeaders(new NextResponse('Not found', { status: 404 }), request);
  }

  if (PUBLIC_HOSTS.has(hostname) && !isFrameworkAsset && !isMarketingPath(pathname)) {
    return appRedirect(request);
  }

  // The application host owns authentication and the CRM. Marketing paths on
  // this host resolve to the app login rather than rendering the public site.
  if (hostname === APP_HOST && !isFrameworkAsset && isMarketingPath(pathname) && !isApiPath) {
    if (pathname === '/sitemap.xml' || pathname === '/robots.txt' || pathname === '/manifest.webmanifest') {
      return applySecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), request);
    }
    return authRedirect('/login', request);
  }

  const isPublicPage = isMarketingPath(pathname) || isAppPublicPage;
  // Public branding assets are required by the login page before a session
  // exists. If they pass through the auth redirect, the browser receives the
  // login HTML instead of the SVG/PNG and renders a broken image.
  const isApiAuthOrAttachment = isApiPath || isFrameworkAsset;

  if (isApiAuthOrAttachment) {
    return applySecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), request);
  }

  // The login layout validates the session before redirecting. Cookie presence
  // alone also includes expired and revoked sessions, which must reach login.

  // If user is accessing protected dashboard page without session cookie
  if (!isAuthPage && !isPublicPage && !token) {
    return authRedirect('/login', request);
  }

  return applySecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), request);
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
