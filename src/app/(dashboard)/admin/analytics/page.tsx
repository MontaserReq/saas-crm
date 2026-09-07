import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import { AnalyticsService } from '@/server/services/AnalyticsService';
import { AnalyticsClientView } from '@/components/admin/AnalyticsClientView';

export default async function AdminAnalyticsPage() {
  const user = (await getCurrentUser())!;

  if (!hasPermission(user, PERMISSIONS.ANALYTICS_VIEW)) {
    redirect('/');
  }

  const data = await AnalyticsService.getAdminAnalytics();

  return <AnalyticsClientView data={data} />;
}
