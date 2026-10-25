import { requireAuth } from '@/lib/auth/session';
import { PlanUpgradeService } from '@/server/services/PlanUpgradeService';
import { SubscriptionView } from '@/components/settings/SubscriptionView';

export default async function SubscriptionPage() {
  const data = await PlanUpgradeService.workspace(await requireAuth());
  return <SubscriptionView data={data} />;
}
