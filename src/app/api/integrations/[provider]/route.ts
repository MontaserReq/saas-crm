import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { isEmailProvider } from '@/lib/integrations/oauth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { rejectUntrustedMutation } from '@/lib/security/web';
import { Prisma } from '@prisma/client';
import { INTEGRATION_AUTHORIZATION_REVOKED, requireCurrentIntegrationAuthorization } from '@/lib/integrations/authorization';

export async function DELETE(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.organizationId || !hasPermission(user, PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const provider = (await params).provider.toLowerCase();
  if (!isEmailProvider(provider)) return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  const providerKey = provider.toUpperCase();
  try {
    const deleted = await prisma.$transaction(async (tx) => {
      // A plan downgrade must not trap credentials that an authorized admin
      // needs to disconnect, so deletion revalidates authority but not entitlement.
      await requireCurrentIntegrationAuthorization(tx, user.id, user.organizationId!, { requireEntitlement: false });
      const integration = await tx.externalIntegration.findUnique({
        where: { organizationId_provider: { organizationId: user.organizationId!, provider: providerKey } },
        select: { id: true },
      });
      if (!integration) return false;
      await tx.externalIntegration.deleteMany({ where: { id: integration.id, organizationId: user.organizationId } });
      await tx.auditLog.create({ data: { organizationId: user.organizationId, actorId: user.id, action: 'INTEGRATION_DISCONNECTED', entityType: 'ExternalIntegration', entityId: integration.id, metadata: JSON.stringify({ provider: providerKey }) } });
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 20_000 });
    return NextResponse.json({ success: true, disconnected: deleted });
  } catch (error) {
    if (error instanceof Error && error.message === INTEGRATION_AUTHORIZATION_REVOKED) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unable to disconnect integration' }, { status: 500 });
  }
}
