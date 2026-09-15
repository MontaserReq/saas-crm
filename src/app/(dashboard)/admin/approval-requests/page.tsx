import { listSchoolApprovalRequestsAction } from '@/server/actions/schools';
import { listTicketApprovalRequestsAction } from '@/server/actions/tickets';
import { ApprovalRequestsClient } from '@/components/admin/ApprovalRequestsClient';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { redirect } from 'next/navigation';

export default async function ApprovalRequestsPage() {
  const user = await getCurrentUser();
  if (!user || (!hasPermission(user, PERMISSIONS.APPROVAL_REQUESTS_VIEW)
    && !hasPermission(user, PERMISSIONS.SCHOOLS_APPROVE_EDIT)
    && !hasPermission(user, PERMISSIONS.SCHOOLS_APPROVE_DELETE)
    && !hasPermission(user, PERMISSIONS.TICKETS_CORRECTION_APPROVE)
    && !hasPermission(user, PERMISSIONS.TICKETS_RESUBMIT_APPROVE))) {
    redirect('/');
  }
  const [schoolRequests, ticketRequests] = await Promise.all([listSchoolApprovalRequestsAction(), listTicketApprovalRequestsAction()]);
  return <ApprovalRequestsClient requests={[...(schoolRequests as any[]).map((request) => ({ ...request, kind: 'SCHOOL' })), ...(ticketRequests as any[]).map((request) => ({ ...request, kind: 'TICKET' }))]} />;
}
