import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPlanFeature } from '@/lib/platform/entitlements';
import { buildSlackInstallUrl, encodeSlackOAuthState, isSlackConfigured } from '@/lib/integrations/slack';
import { getAppUrl } from '@/lib/integrations/oauth';
import { canManageIntegrations } from '@/lib/integrations/authorization';
import { IntegrationEntitlementService } from '@/server/services/IntegrationEntitlementService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appUrl = getAppUrl(url.origin);
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/login?connect=slack', appUrl));
  if (!user.organizationId || !hasPlanFeature(user, 'integrations') || !canManageIntegrations(user) || !(await IntegrationEntitlementService.isEnabledForUser(user, 'SLACK'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!isSlackConfigured()) return NextResponse.redirect(new URL('/settings/integrations?slack=not-configured', appUrl));

  const state = randomBytes(32).toString('hex');
  const authUrl = buildSlackInstallUrl(appUrl);
  authUrl.searchParams.set('state', state);
  const response = NextResponse.redirect(authUrl);
  response.cookies.set('satrcrm_slack_oauth_state', encodeSlackOAuthState({ state, userId: user.id, organizationId: user.organizationId, issuedAt: Date.now() }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60,
    path: '/',
  });
  return response;
}

