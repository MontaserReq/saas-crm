import { NextResponse } from 'next/server';
import { isIP } from 'node:net';
import { trustsSingleHopProxy } from '@/lib/security/runtimeConfig';

export function clientIp(request: Request): string {
  return resolveClientIp({
    forwarded: request.headers.get('x-forwarded-for'),
    realIp: request.headers.get('x-real-ip'),
    runtimeIp: (request as Request & { ip?: string }).ip,
  });
}

export function resolveClientIp(input: { forwarded?: string | null; realIp?: string | null; runtimeIp?: string | null }): string {
  if (trustsSingleHopProxy()) {
    // In single-hop mode the trusted edge must replace, rather than append to,
    // forwarding headers. Multi-value chains are rejected instead of guessed.
    const forwarded = input.forwarded?.trim() || '';
    if (forwarded) return !forwarded.includes(',') && isIP(forwarded) ? forwarded : 'anonymous';
    const value = input.realIp?.trim() || '';
    return isIP(value) ? value : 'anonymous';
  }
  const runtimeIp = input.runtimeIp?.trim();
  return runtimeIp && isIP(runtimeIp) ? runtimeIp : 'anonymous';
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
