import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { z } from 'zod';
import { clientIp, tooManyRequests } from '@/lib/security/api';
import { checkRateLimit, RATE_LIMIT_POLICY_CONFIG } from '@/lib/security/rateLimiter';

const querySchema = z.object({ q: z.string().trim().min(2).max(80) });
export async function GET(request: NextRequest) {
  const policy = RATE_LIMIT_POLICY_CONFIG.public_search;
  const limited = await checkRateLimit({ policy: 'public_search', identity: `public-search-ip:${clientIp(request)}`, ...policy });
  if (!limited.allowed) {
    return tooManyRequests(limited.retryAfterSeconds ?? policy.windowSeconds, {
      limit: policy.limit,
      remaining: limited.remaining ?? 0,
      resetAt: limited.resetAt?.getTime(),
    });
  }
  const parsed = querySchema.safeParse({ q: request.nextUrl.searchParams.get('q') || '' });
  if (!parsed.success) return NextResponse.json({ data: [] });
  const q = parsed.data.q;
  const data = await prisma.school.findMany({ where: { isPublic: true, isDeleted: false, OR: [{ name: { contains: q, mode: 'insensitive' } }, { city: { contains: q, mode: 'insensitive' } }, { publicDescription: { contains: q, mode: 'insensitive' } }] }, select: { id: true, name: true, city: true, area: true, schoolType: true, publicDescription: true }, take: 25, orderBy: { name: 'asc' } });
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'private, max-age=10' } });
}
