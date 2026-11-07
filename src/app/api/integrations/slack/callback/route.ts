import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { hasPlanFeature } from '@/lib/platform/entitlements';
import { canManageIntegrations, INTEGRATION_AUTHORIZATION_REVOKED, requireCurrentIntegrationAuthorization } from '@/lib/integrations/authorization';
import { decodeSlackOAuthState, encryptedSlackToken, exchangeSlackCode, getSlackRedirectUri, isSlackConfigured, parseSlackMetadata, serializeSlackMetadata, SLACK_PROVIDER } from '@/lib/integrations/slack';
import { getAppUrl } from '@/lib/integrations/oauth';
import { IntegrationEntitlementService } from '@/server/services/IntegrationEntitlementService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cookieValue(request: Request) {
  const raw = request.headers.get('cookie')?.match(/(?:^|; )satrcrm_slack_oauth_state=([^;]+)/)?.[1];
  if (!raw) return null;
  try { return decodeURIComponent(raw); } catch { return null; }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appUrl = getAppUrl(url.origin);
  const clearAndRedirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, appUrl));
    response.cookies.delete('satrcrm_slack_oauth_state');
    return response;
  };

  if (url.searchParams.get('error')) return clearAndRedirect('/settings/integrations?slack=cancelled');
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const stateData = decodeSlackOAuthState(cookieValue(request));
  if (!code || !returnedState || !stateData || returnedState !== stateData.state) return clearAndRedirect('/settings/integrations?slack=failed&reason=invalid-state');

  const user = await getCurrentUser();
  if (!user) return clearAndRedirect('/login?connect=slack');
  if (stateData.userId !== user.id || !user.organizationId || stateData.organizationId !== user.organizationId) return clearAndRedirect('/settings/integrations?slack=failed&reason=identity-mismatch');
  if (!hasPlanFeature(user, 'integrations') || !canManageIntegrations(user) || !(await IntegrationEntitlementService.isEnabledForUser(user, 'SLACK'))) return clearAndRedirect('/settings/integrations?slack=failed&reason=forbidden');
  if (!isSlackConfigured()) return clearAndRedirect('/settings/integrations?slack=not-configured');

  let token: Awaited<ReturnType<typeof exchangeSlackCode>>;
  try {
    token = await exchangeSlackCode(code, getSlackRedirectUri(appUrl));
  } catch {
    return clearAndRedirect('/settings/integrations?slack=failed&reason=token-exchange');
  }
  const accessToken = typeof token.access_token === 'string' ? token.access_token : '';
  const teamId = typeof token.team?.id === 'string' ? token.team.id : '';
  const teamName = typeof token.team?.name === 'string' ? token.team.name : '';
  if (!accessToken || !teamId || !teamName) return clearAndRedirect('/settings/integrations?slack=failed&reason=missing-workspace');

  const metadata = { teamId, teamName, botUserId: typeof token.bot_user_id === 'string' ? token.bot_user_id : null, defaultChannelId: null, defaultChannelName: null };
  try {
    await prisma.$transaction(async (tx) => {
      await requireCurrentIntegrationAuthorization(tx, user.id, user.organizationId!);
      const existing = await tx.externalIntegration.findUnique({ where: { organizationId_provider: { organizationId: user.organizationId!, provider: SLACK_PROVIDER } }, select: { id: true, metadata: true } });
      const oldMetadata = parseSlackMetadata(existing?.metadata);
      const savedMetadata = serializeSlackMetadata({ ...metadata, defaultChannelId: oldMetadata?.teamId === teamId ? oldMetadata.defaultChannelId : null, defaultChannelName: oldMetadata?.teamId === teamId ? oldMetadata.defaultChannelName : null });
      const integration = await tx.externalIntegration.upsert({
        where: { organizationId_provider: { organizationId: user.organizationId!, provider: SLACK_PROVIDER } },
        create: { organizationId: user.organizationId!, provider: SLACK_PROVIDER, accountEmail: teamName, accessTokenEncrypted: encryptedSlackToken(accessToken), refreshTokenEncrypted: typeof token.refresh_token === 'string' ? encryptedSlackToken(token.refresh_token) : null, tokenExpiresAt: typeof token.expires_in === 'number' && token.expires_in > 0 ? new Date(Date.now() + token.expires_in * 1000) : null, scopes: JSON.stringify(typeof token.scope === 'string' ? token.scope.split(',').filter(Boolean) : []), metadata: savedMetadata },
        update: { accountEmail: teamName, accessTokenEncrypted: encryptedSlackToken(accessToken), refreshTokenEncrypted: typeof token.refresh_token === 'string' ? encryptedSlackToken(token.refresh_token) : null, tokenExpiresAt: typeof token.expires_in === 'number' && token.expires_in > 0 ? new Date(Date.now() + token.expires_in * 1000) : null, scopes: JSON.stringify(typeof token.scope === 'string' ? token.scope.split(',').filter(Boolean) : []), metadata: savedMetadata },
      });
      await tx.auditLog.create({ data: { organizationId: user.organizationId!, actorId: user.id, action: existing ? 'INTEGRATION_REPLACED' : 'INTEGRATION_CONNECTED', entityType: 'ExternalIntegration', entityId: integration.id, metadata: JSON.stringify({ provider: SLACK_PROVIDER, teamId, scopes: typeof token.scope === 'string' ? token.scope.split(',').filter(Boolean) : [] }) } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 20_000 });
  } catch (error) {
    if (error instanceof Error && error.message === INTEGRATION_AUTHORIZATION_REVOKED) return clearAndRedirect('/settings/integrations?slack=failed&reason=forbidden');
    return clearAndRedirect('/settings/integrations?slack=failed&reason=storage');
  }
  return clearAndRedirect('/settings/integrations?slack=connected');
}

