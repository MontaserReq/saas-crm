import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { ChatService } from '@/server/services/ChatService';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(user, PERMISSIONS.CHAT_VIEW)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({ start(controller) { const push = async () => { if (closed) return; try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(await ChatService.list(user.id))}\n\n`)); } catch { closed = true; controller.close(); } }; push(); const timer = setInterval(push, 5000); return () => { closed = true; clearInterval(timer); }; } });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } });
}
