import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { hasPlanFeature } from '@/lib/platform/entitlements';
import prisma from '@/lib/db/prisma';
import { EmailIntegrationSettings } from '@/components/settings/EmailIntegrationSettings';
import { CanvaIntegrationSettings } from '@/components/settings/CanvaIntegrationSettings';
import { SlackIntegrationSettings } from '@/components/settings/SlackIntegrationSettings';
import { parseSlackMetadata } from '@/lib/integrations/slack';
import { getCanvaRedirectUri } from '@/lib/integrations/canva';
import { canManageIntegrations } from '@/lib/integrations/authorization';
import { Link2, Puzzle } from 'lucide-react';

export default async function IntegrationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const canManage = canManageIntegrations(user);
  const canUseIntegrations = hasPlanFeature(user, 'integrations');
  if (!canUseIntegrations && !canManage) redirect('/settings');

  const [integrations, canvaConnection] = await Promise.all([
    user.organizationId
      ? prisma.externalIntegration.findMany({ where: { organizationId: user.organizationId }, select: { provider: true, accountEmail: true, scopes: true, tokenExpiresAt: true, metadata: true } })
      : Promise.resolve([]),
    user.organizationId
      ? prisma.canvaConnection.findUnique({ where: { organizationId_userId: { organizationId: user.organizationId, userId: user.id } }, select: { accountEmail: true, tokenExpiresAt: true } })
      : Promise.resolve(null),
  ]);

  const emailIntegrations = integrations
    .filter((item) => ['google', 'microsoft'].includes(item.provider.toLowerCase()))
    .map((item) => {
      let scopes: string[] = [];
      try { scopes = JSON.parse(item.scopes || '[]'); } catch { scopes = []; }
      return { ...item, provider: item.provider.toLowerCase(), scopes, tokenExpiresAt: item.tokenExpiresAt?.toISOString() || null };
    });
  const slack = integrations.find((item) => item.provider === 'SLACK');
  const slackMetadata = parseSlackMetadata(slack?.metadata);

  return <div className="space-y-6">
    <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300" aria-hidden="true"><Puzzle className="h-6 w-6" /></span>
        <div>
          <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">التكاملات · Integrations</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">التكاملات</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">اربط الأدوات التي يستخدمها فريقك من مكان واحد. اتصالات Canva شخصية لكل مستخدم، بينما Slack والبريد مرتبطان بمساحة الشركة.</p>
        </div>
      </div>
      <div className="mt-5 flex items-start gap-2 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm leading-6 text-brand-900 dark:border-brand-900/50 dark:bg-brand-950/20 dark:text-brand-100"><Link2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>لربط Canva، اختر حساب Canva الخاص بك من شاشة التفويض. لا تستخدم حساب الشركة المشترك.</span></div>
    </header>

    <div className="space-y-6">
      {canUseIntegrations && <EmailIntegrationSettings integrations={emailIntegrations} canManage={canManage} googleApprovalPending={process.env.GOOGLE_EMAIL_INTEGRATION_PENDING_REVIEW === 'true'} />}
      {(canUseIntegrations || canManage) && <CanvaIntegrationSettings connection={{ connected: Boolean(canvaConnection), accountEmail: canvaConnection?.accountEmail || null, tokenExpiresAt: canvaConnection?.tokenExpiresAt?.toISOString() || null }} canManage={canUseIntegrations && canManage} available={canUseIntegrations} configured={Boolean(process.env.CANVA_CLIENT_ID?.trim() && process.env.CANVA_CLIENT_SECRET?.trim())} redirectUri={getCanvaRedirectUri()} startUrl={new URL('/api/integrations/canva/start', getCanvaRedirectUri()).toString()} />}
      {(canUseIntegrations || canManage) && <SlackIntegrationSettings organizationName={user.organizationName || 'current organization'} connection={{ configured: Boolean(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET && process.env.SLACK_SIGNING_SECRET), connected: Boolean(slack && slackMetadata), teamName: slackMetadata?.teamName || null, defaultChannelId: slackMetadata?.defaultChannelId || null, defaultChannelName: slackMetadata?.defaultChannelName || null }} canManage={canManage} available={canUseIntegrations} />}
    </div>
  </div>;
}
