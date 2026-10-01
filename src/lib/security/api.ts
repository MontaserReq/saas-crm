import { NextResponse } from 'next/server';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const trustedProxy = process.env.TRUST_PROXY === 'true';
  if (trustedProxy) {
    const value = (forwarded?.split(',')[0] || request.headers.get('x-real-ip') || '').trim();
    return value.length <= 128 && value ? value : 'anonymous';
  }
  const runtimeIp = (request as Request & { ip?: string }).ip;
  return runtimeIp && runtimeIp.length <= 128 ? runtimeIp : 'anonymous';
}

export function rateLimit(request: Request, key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucketKey = `${clientIp(request)}:${key}`;
  const current = buckets.get(bucketKey);
  if (buckets.size >= MAX_BUCKETS) {
    for (const [k, value] of buckets) if (value.resetAt <= now) buckets.delete(k);
    if (buckets.size >= MAX_BUCKETS) buckets.delete(buckets.keys().next().value as string);
  }
  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  return { allowed: current.count <= limit, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
}

export function tooManyRequests(retryAfter: number) {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } });
}

export function internalError() {
  return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
}
