import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { verifySlackRequestSignature, SLACK_PROVIDER } from '@/lib/integrations/slack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 256 * 1024;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  if (!verifySlackRequestSignature(rawBody, request.headers.get('x-slack-request-timestamp'), request.headers.get('x-slack-signature'))) return NextResponse.json({ error: 'Invalid Slack signature' }, { status: 401 });

  let payload: { type?: string; challenge?: string; team_id?: string; event?: { type?: string } };
  try { payload = JSON.parse(rawBody) as typeof payload; } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (payload.type === 'url_verification' && typeof payload.challenge === 'string') return NextResponse.json({ challenge: payload.challenge });

  if (payload.type === 'event_callback' && payload.event?.type === 'app_uninstalled' && payload.team_id) {
    await prisma.externalIntegration.deleteMany({ where: { provider: SLACK_PROVIDER, metadata: { contains: `"teamId":"${payload.team_id}"` } } });
  }
  return NextResponse.json({ ok: true });
}

