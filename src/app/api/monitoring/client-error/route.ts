import { NextResponse } from 'next/server';
import { reportApplicationError } from '@/lib/monitoring/server';

export const runtime = 'nodejs';
const recentByIp = new Map<string, number>();

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const previous = recentByIp.get(ip);
  if (previous && now - previous < 2_000) return NextResponse.json({ accepted: true });
  recentByIp.set(ip, now);

  try {
    const body = await request.json();
    const message = typeof body?.message === 'string' ? body.message.slice(0, 2_000) : '';
    if (!message) return NextResponse.json({ accepted: false }, { status: 400 });
    await reportApplicationError({
      source: 'client', message,
      stack: typeof body.stack === 'string' ? body.stack.slice(0, 4_000) : undefined,
      path: typeof body.path === 'string' ? body.path.slice(0, 1_000) : undefined,
      details: {
        filename: typeof body.filename === 'string' ? body.filename.slice(0, 500) : undefined,
        line: typeof body.line === 'number' ? body.line : undefined,
        column: typeof body.column === 'number' ? body.column : undefined,
      },
    });
    return NextResponse.json({ accepted: true });
  } catch {
    return NextResponse.json({ accepted: false }, { status: 400 });
  }
}
