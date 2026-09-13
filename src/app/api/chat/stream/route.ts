import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { ChatService } from '@/server/services/ChatService';
import { PresenceService } from '@/server/services/PresenceService';
import prisma from '@/lib/db/prisma';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

async function buildPayload(userId: string) {
  const [conversations, activeUsers] = await Promise.all([
    ChatService.list(userId),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true } }),
  ]);
  const presence = await PresenceService.getLastSeenMap(activeUsers.map((u) => u.id));
  return { conversations, presence };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(user, PERMISSIONS.CHAT_VIEW)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({ start(controller) { const push = async () => { if (closed) return; try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(await buildPayload(user.id))}\n\n`)); } catch { closed = true; controller.close(); } }; push(); const timer = setInterval(push, 5000); return () => { closed = true; clearInterval(timer); }; } });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } });
}
