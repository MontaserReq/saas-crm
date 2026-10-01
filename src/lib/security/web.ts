import { NextResponse } from 'next/server';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function getConfiguredOrigin(): string | null {
  const raw = process.env.APP_ORIGIN?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function originFrom(value: string): string | null {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method.toUpperCase());
}

export function isTrustedOrigin(value: string | null | undefined): boolean {
  const expected = getConfiguredOrigin();
  return Boolean(expected && value && originFrom(value) === expected);
}

export function validateMutationOrigin(request: Request): { ok: true } | { ok: false; reason: string } {
  if (isSafeMethod(request.method)) return { ok: true };
  const expected = getConfiguredOrigin();
  if (!expected) return { ok: false, reason: 'APP_ORIGIN is not configured' };

  const origin = request.headers.get('origin');
  if (origin) return originFrom(origin) === expected ? { ok: true } : { ok: false, reason: 'Origin is not trusted' };

  const referer = request.headers.get('referer');
  if (referer) return originFrom(referer) === expected ? { ok: true } : { ok: false, reason: 'Referer is not trusted' };

  // Cookie-authenticated browser mutations must provide an origin signal. Public
  // endpoints and non-cookie service calls do not use this helper.
  return { ok: false, reason: 'Origin or Referer is required' };
}

export function rejectUntrustedMutation(request: Request): NextResponse | null {
  const result = validateMutationOrigin(request);
  return result.ok ? null : NextResponse.json({ success: false, error: 'Untrusted request origin' }, { status: 403 });
}

export function applySecurityHeaders<T extends Response>(response: T, request?: Request): T {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');

  const url = request ? new URL(request.url) : null;
  const forwardedHttps = process.env.TRUST_PROXY === 'true' && request?.headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'https';
  if (url?.protocol === 'https:' || forwardedHttps) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  return response;
}

export function securityHeaders(response: Response, request: Request): Response {
  return applySecurityHeaders(response, request);
}
