import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { rejectUntrustedMutation } from '@/lib/security/web';
import { postSlackMessage } from '@/lib/integrations/slack';
import { canManageIntegrations } from '@/lib/integrations/authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.organizationId || !canManageIntegrations(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const result = await postSlackMessage(user.organizationId, 'SatrCRM test notification: Slack is connected successfully.');
    if (!result.sent) return NextResponse.json({ error: result.reason === 'channel_not_configured' ? 'Choose a Slack channel first' : 'Slack is not connected' }, { status: 400 });
    return NextResponse.json({ sent: true });
  } catch {
    return NextResponse.json({ error: 'Slack rejected the test message' }, { status: 502 });
  }
}

