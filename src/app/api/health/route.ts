import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const headers = { 'Cache-Control': 'no-store' };

export async function GET() {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('health-check-timeout')), 3_000); }),
    ]);
    return NextResponse.json({ status: 'ok' }, { status: 200, headers });
  } catch {
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
