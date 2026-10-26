import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getCurrentUser } from '@/lib/auth/session';
import { EMAIL_SCOPES, encodeOAuthState, getAppUrl, getProviderCredentials, getRedirectUri, isEmailProvider, isGoogleIntegrationPendingReview, requestedScopes } from '@/lib/integrations/oauth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { hasPlanFeature } from '@/lib/platform/entitlements';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appUrl = getAppUrl(url.origin);
  const provider = url.searchParams.get('provider');
  if (!isEmailProvider(provider)) return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(`/login?connect=${provider}`, appUrl));
  if (!user.organizationId || (!hasPermission(user, PERMISSIONS.EMAIL_INTEGRATIONS_MANAGE) && !hasPermission(user, PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE)) || !hasPlanFeature(user, 'integrations')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (provider === 'google' && isGoogleIntegrationPendingReview()) return NextResponse.redirect(new URL('/settings?integration=google-review-pending', appUrl));
  const credentials = getProviderCredentials(provider);
  if (!credentials.clientId || !credentials.clientSecret) return NextResponse.redirect(new URL(`/settings?integration=not-configured&provider=${provider}`, appUrl));
  const requested = (url.searchParams.get('scopes') || 'email,calendar').split(',').filter((item) => item in EMAIL_SCOPES[provider]);
  const { selected, scopes } = requestedScopes(provider, requested);
  const state = randomBytes(32).toString('hex');
  const authUrl = provider === 'google' ? new URL('https://accounts.google.com/o/oauth2/v2/auth') : new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
  authUrl.search = new URLSearchParams({ client_id: credentials.clientId, redirect_uri: getRedirectUri(appUrl), response_type: 'code', response_mode: 'query', scope: scopes.join(' '), state, access_type: 'offline', prompt: 'consent' }).toString();
  const response = NextResponse.redirect(authUrl);
  response.cookies.set('codeline_oauth_state', encodeOAuthState({ state, provider, selected, userId: user.id, organizationId: user.organizationId, issuedAt: Date.now() }), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 10 * 60, path: '/' });
  return response;
}
