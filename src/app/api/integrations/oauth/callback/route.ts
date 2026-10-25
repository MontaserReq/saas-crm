import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { decodeOAuthState, encryptSecret, getAppUrl, getProviderCredentials, getRedirectUri } from '@/lib/integrations/oauth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { hasPlanFeature } from '@/lib/platform/entitlements';
import { Prisma } from '@prisma/client';
import { INTEGRATION_AUTHORIZATION_REVOKED, requireCurrentIntegrationAuthorization } from '@/lib/integrations/authorization';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const cookieValue = request.headers.get('cookie')?.match(/(?:^|; )codeline_oauth_state=([^;]+)/)?.[1];
  let decodedCookie: string | null = null;
  try { decodedCookie = cookieValue ? decodeURIComponent(cookieValue) : null; } catch { decodedCookie = null; }
  const stateData = decodeOAuthState(decodedCookie);
  const clearAndRedirect = (path: string) => { const response = NextResponse.redirect(new URL(path, getAppUrl())); response.cookies.delete('codeline_oauth_state'); return response; };
  if (url.searchParams.get('error')) return clearAndRedirect('/settings?integration=cancelled');
  if (!code || !returnedState || !stateData || returnedState !== stateData.state) return clearAndRedirect('/settings?integration=failed&reason=invalid-state');
  const user = await getCurrentUser();
  if (!user) return clearAndRedirect(`/login?connect=${stateData.provider}`);
  if (stateData.userId !== user.id) return clearAndRedirect('/settings?integration=failed&reason=state-user-mismatch');
  const organizationId = user.organizationId;
  if (!organizationId || stateData.organizationId !== organizationId) return clearAndRedirect('/settings?integration=failed&reason=organization-mismatch');
  if (!hasPermission(user, PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE) || !hasPlanFeature(user, 'integrations')) return clearAndRedirect('/settings?integration=failed&reason=forbidden');
  const provider = stateData.provider;
  const credentials = getProviderCredentials(provider);
  if (!credentials.clientId || !credentials.clientSecret) return clearAndRedirect('/settings?integration=failed&reason=not-configured');
  const tokenUrl = provider === 'google' ? 'https://oauth2.googleapis.com/token' : 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: credentials.clientId || '', client_secret: credentials.clientSecret || '', redirect_uri: getRedirectUri(), grant_type: 'authorization_code' }) });
  } catch {
    return clearAndRedirect('/settings?integration=failed&reason=token-exchange');
  }
  if (!tokenResponse.ok) return clearAndRedirect('/settings?integration=failed&reason=token-exchange');
  const token = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!token.access_token) return clearAndRedirect('/settings?integration=failed&reason=missing-token');
  const accessToken = token.access_token;
  let profile: { email?: string; mail?: string; userPrincipalName?: string } = {};
  try {
    const profileResponse = provider === 'google' ? await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } }) : await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', { headers: { Authorization: `Bearer ${accessToken}` } });
    if (profileResponse.ok) profile = await profileResponse.json() as typeof profile;
  } catch {
    // Provider profile lookup is optional; credential storage remains bound to
    // the authenticated user and organization even without an account label.
  }
  const accountEmail = profile.email || profile.mail || profile.userPrincipalName || null;
  try {
    await prisma.$transaction(async (tx) => {
      await requireCurrentIntegrationAuthorization(tx, user.id, organizationId);
      const providerKey = provider.toUpperCase();
      const existing = await tx.externalIntegration.findUnique({ where: { organizationId_provider: { organizationId, provider: providerKey } }, select: { id: true } });
      const integration = await tx.externalIntegration.upsert({ where: { organizationId_provider: { organizationId, provider: providerKey } }, create: { organizationId, provider: providerKey, accountEmail, accessTokenEncrypted: encryptSecret(accessToken), refreshTokenEncrypted: token.refresh_token ? encryptSecret(token.refresh_token) : null, tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null, scopes: JSON.stringify(stateData.selected) }, update: { accountEmail, accessTokenEncrypted: encryptSecret(accessToken), ...(token.refresh_token ? { refreshTokenEncrypted: encryptSecret(token.refresh_token) } : {}), tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null, scopes: JSON.stringify(stateData.selected) } });
      await tx.auditLog.create({ data: { organizationId, actorId: user.id, action: existing ? 'INTEGRATION_REPLACED' : 'INTEGRATION_CONNECTED', entityType: 'ExternalIntegration', entityId: integration.id, metadata: JSON.stringify({ provider: providerKey, scopes: stateData.selected }) } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 20_000 });
  } catch (error) {
    if (error instanceof Error && error.message === INTEGRATION_AUTHORIZATION_REVOKED) {
      return clearAndRedirect('/settings?integration=failed&reason=forbidden');
    }
    return clearAndRedirect('/settings?integration=failed&reason=storage');
  }
  return clearAndRedirect(`/settings?integration=connected&provider=${provider}`);
}
