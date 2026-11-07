import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getSlackIntegration, isSlackConfigured } from '@/lib/integrations/slack';
import { canViewIntegrations } from '@/lib/integrations/authorization';
import { IntegrationEntitlementService } from '@/server/services/IntegrationEntitlementService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseScopes(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.organizationId || !canViewIntegrations(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!(await IntegrationEntitlementService.isEnabledForUser(user, 'SLACK'))) return NextResponse.json({ configured: isSlackConfigured(), connected: false, disabled: true }, { headers: { 'Cache-Control': 'no-store' } });
  const integration = await getSlackIntegration(user.organizationId);
  return NextResponse.json({ configured: isSlackConfigured(), connected: Boolean(integration), connection: integration ? { teamName: integration.metadata.teamName, teamId: integration.metadata.teamId, defaultChannelId: integration.metadata.defaultChannelId, defaultChannelName: integration.metadata.defaultChannelName, updatedAt: integration.updatedAt.toISOString(), scopes: parseScopes(integration.scopes || '[]') } : null }, { headers: { 'Cache-Control': 'no-store' } });
}

