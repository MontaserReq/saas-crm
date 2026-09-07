import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { z } from 'zod';

const buckets = new Map<string, { count: number; at: number }>();
const querySchema = z.object({ q: z.string().trim().min(2).max(80) });
export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'; const now = Date.now(); const bucket = buckets.get(ip);
  if (bucket && now - bucket.at < 60_000 && bucket.count >= 30) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  buckets.set(ip, bucket && now - bucket.at < 60_000 ? { count: bucket.count + 1, at: bucket.at } : { count: 1, at: now });
  const parsed = querySchema.safeParse({ q: request.nextUrl.searchParams.get('q') || '' });
  if (!parsed.success) return NextResponse.json({ data: [] });
  const q = parsed.data.q;
  const data = await prisma.school.findMany({ where: { isPublic: true, isDeleted: false, OR: [{ name: { contains: q, mode: 'insensitive' } }, { city: { contains: q, mode: 'insensitive' } }, { publicDescription: { contains: q, mode: 'insensitive' } }] }, select: { id: true, name: true, city: true, area: true, schoolType: true, publicDescription: true }, take: 25, orderBy: { name: 'asc' } });
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'private, max-age=10' } });
}
