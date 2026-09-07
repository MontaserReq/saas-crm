import { listSchoolApprovalRequestsAction } from '@/server/actions/schools';
import { ApprovalRequestsClient } from '@/components/admin/ApprovalRequestsClient';

export default async function ApprovalRequestsPage() {
  const requests = await listSchoolApprovalRequestsAction();
  return <ApprovalRequestsClient requests={requests as any} />;
}
