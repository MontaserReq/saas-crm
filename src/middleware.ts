import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('codeline_session')?.value;

  const isAuthPage = pathname.startsWith('/login');
  const isPublicPage = pathname.startsWith('/public-search');
  const isApiAuthOrAttachment = pathname.startsWith('/api/') || pathname.startsWith('/_next') || pathname.includes('/favicon.ico');

  if (isApiAuthOrAttachment) {
    return NextResponse.next();
  }

  // If user is accessing login page while already possessing session cookie
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If user is accessing protected dashboard page without session cookie
  if (!isAuthPage && !isPublicPage && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
