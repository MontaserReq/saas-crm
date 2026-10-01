import { NextResponse } from 'next/server';

export function clientIp(request: Request): string {
  return resolveClientIp({
    forwarded: request.headers.get('x-forwarded-for'),
    realIp: request.headers.get('x-real-ip'),
    runtimeIp: (request as Request & { ip?: string }).ip,
  });
}

export function resolveClientIp(input: { forwarded?: string | null; realIp?: string | null; runtimeIp?: string | null }): string {
  const trustedProxy = process.env.TRUST_PROXY === 'true';
  if (trustedProxy) {
    const value = (input.forwarded?.split(',')[0] || input.realIp || '').trim();
    return value.length <= 128 && value ? value : 'anonymous';
  }
  const runtimeIp = input.runtimeIp?.trim();
  return runtimeIp && runtimeIp.length <= 128 ? runtimeIp : 'anonymous';
}

export function tooManyRequests(retryAfter: number, details?: { limit?: number; remaining?: number; resetAt?: number }) {
  const headers: Record<string, string> = { 'Retry-After': String(Math.max(1, retryAfter)) };
  if (details?.limit !== undefined) headers['X-RateLimit-Limit'] = String(details.limit);
  if (details?.remaining !== undefined) headers['X-RateLimit-Remaining'] = String(Math.max(0, details.remaining));
  if (details?.resetAt !== undefined) headers['X-RateLimit-Reset'] = String(Math.floor(details.resetAt / 1000));
  return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers });
}

export function internalError() {
  return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
}
