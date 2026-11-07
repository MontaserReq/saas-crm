import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { listSlackChannels } from '@/lib/integrations/slack';
import { canViewIntegrations } from '@/lib/integrations/authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.organizationId || !canViewIntegrations(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    return NextResponse.json({ channels: await listSlackChannels(user.organizationId) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load Slack channels' }, { status: 502 });
  }
}

