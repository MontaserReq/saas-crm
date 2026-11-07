import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth/session';
import { rejectUntrustedMutation } from '@/lib/security/web';
import prisma from '@/lib/db/prisma';
import { canManageIntegrations, INTEGRATION_AUTHORIZATION_REVOKED, requireCurrentIntegrationAuthorization } from '@/lib/integrations/authorization';
import { getSlackIntegration, slackApi, SLACK_PROVIDER } from '@/lib/integrations/slack';
import { IntegrationEntitlementService } from '@/server/services/IntegrationEntitlementService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request: Request) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.organizationId || !canManageIntegrations(user) || !(await IntegrationEntitlementService.isEnabledForUser(user, 'SLACK'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    await prisma.$transaction((tx) => requireCurrentIntegrationAuthorization(tx, user.id, user.organizationId!, { requireEntitlement: false }));
  } catch (error) {
    if (error instanceof Error && error.message === INTEGRATION_AUTHORIZATION_REVOKED) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unable to verify Slack authorization' }, { status: 500 });
  }

  const existing = await getSlackIntegration(user.organizationId);
  if (existing) {
    try { await slackApi('auth.revoke', existing.accessToken); } catch { /* Local deletion is authoritative. */ }
  }
  try {
    const deleted = await prisma.$transaction(async (tx) => {
      await requireCurrentIntegrationAuthorization(tx, user.id, user.organizationId!, { requireEntitlement: false });
      const integration = await tx.externalIntegration.findUnique({ where: { organizationId_provider: { organizationId: user.organizationId!, provider: SLACK_PROVIDER } }, select: { id: true } });
      if (!integration) return false;
      await tx.externalIntegration.deleteMany({ where: { id: integration.id, organizationId: user.organizationId! } });
      await tx.auditLog.create({ data: { organizationId: user.organizationId!, actorId: user.id, action: 'INTEGRATION_DISCONNECTED', entityType: 'ExternalIntegration', entityId: integration.id, metadata: JSON.stringify({ provider: SLACK_PROVIDER }) } });
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 20_000 });
    return NextResponse.json({ disconnected: deleted });
  } catch (error) {
    if (error instanceof Error && error.message === INTEGRATION_AUTHORIZATION_REVOKED) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unable to disconnect Slack' }, { status: 500 });
  }
}

