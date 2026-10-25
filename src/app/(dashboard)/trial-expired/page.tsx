import { requireAuth } from '@/lib/auth/session';
import { PlanUpgradeService } from '@/server/services/PlanUpgradeService';
import { TrialExpiredView } from '@/components/settings/TrialExpiredView';
import { redirect } from 'next/navigation';

export default async function TrialExpiredPage() {
  const user = await requireAuth();
  if (user.workspaceAccessState !== 'TRIAL_EXPIRED' && user.workspaceAccessState !== 'PAID_EXPIRED') redirect('/settings/subscription');
  return <TrialExpiredView data={await PlanUpgradeService.workspace(user)} state={user.workspaceAccessState} />;
}
