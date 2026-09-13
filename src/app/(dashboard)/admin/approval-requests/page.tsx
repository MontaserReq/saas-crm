import { listSchoolApprovalRequestsAction } from '@/server/actions/schools';
import { ApprovalRequestsClient } from '@/components/admin/ApprovalRequestsClient';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { redirect } from 'next/navigation';

export default async function ApprovalRequestsPage() {
  const user = await getCurrentUser();
  if (!user || (!hasPermission(user, PERMISSIONS.APPROVAL_REQUESTS_VIEW)
    && !hasPermission(user, PERMISSIONS.SCHOOLS_APPROVE_EDIT)
    && !hasPermission(user, PERMISSIONS.SCHOOLS_APPROVE_DELETE))) {
    redirect('/');
  }
  const requests = await listSchoolApprovalRequestsAction();
  return <ApprovalRequestsClient requests={requests as any} />;
}
