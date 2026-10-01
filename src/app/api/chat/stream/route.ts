import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { ChatService } from '@/server/services/ChatService';
import { PresenceService } from '@/server/services/PresenceService';
import prisma from '@/lib/db/prisma';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

async function buildPayload(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) throw new Error('Unauthorized');
  const organizationId = user.organizationId || 'org_codeline_legacy';
  const [conversations, activeUsers] = await Promise.all([
    ChatService.list(user),
    prisma.user.findMany({ where: { isActive: true, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } }, select: { id: true } }),
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
  let timer: ReturnType<typeof setInterval> | undefined;
  let pushing = false;

  const stream = new ReadableStream({
    start(controller) {
      const closeSafely = () => {
        if (closed) return;
        closed = true;
        if (timer) clearInterval(timer);
        try {
          controller.close();
        } catch {
          // The client may have cancelled the stream between the state check
          // and close(), which is safe and requires no further action.
        }
      };

      const push = async () => {
        if (closed || pushing) return;
        pushing = true;
        try {
          const payload = await buildPayload(user);
          if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          closeSafely();
        } finally {
          pushing = false;
        }
      };

      void push();
      timer = setInterval(() => void push(), 5000);
    },
    cancel() {
      closed = true;
      if (timer) clearInterval(timer);
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } });
}
