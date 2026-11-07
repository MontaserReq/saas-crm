import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { rejectUntrustedMutation } from '@/lib/security/web';
import { saveSlackChannel } from '@/lib/integrations/slack';
import { canManageIntegrations } from '@/lib/integrations/authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ channelId: z.string().regex(/^[A-Z0-9]{1,30}$/) }).strict();

export async function PATCH(request: Request) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.organizationId || !canManageIntegrations(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid Slack channel' }, { status: 400 });
  try {
    const channel = await saveSlackChannel(user.organizationId, parsed.data.channelId);
    return NextResponse.json({ channel });
  } catch {
    return NextResponse.json({ error: 'Slack channel is not available to this app' }, { status: 400 });
  }
}

