import { getCurrentUser } from '@/lib/auth/session';
import { TicketService } from '@/server/services/TicketService';
import { notFound } from 'next/navigation';
import { TicketDetailClientView } from '@/components/tickets/TicketDetailClientView';
import prisma from '@/lib/db/prisma';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { isPlatformSuperAdmin } from '@/lib/security/platform';
import { TicketAccessRestricted } from '@/components/tickets/TicketAccessRestricted';

export default async function TicketDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = (await getCurrentUser())!;
  const routeParams = await params;

  let ticket: any;
  try {
    ticket = await TicketService.getTicketById(user, routeParams.id);
  } catch (err: any) {
    return <TicketAccessRestricted />;
  }

  if (!ticket) {
    notFound();
  }

  const [teamMembers, schools, taskTypes, departmentsWithUsers] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, id: { not: user.id }, organizationMemberships: { some: { organizationId: user.organizationId, status: 'ACTIVE' } } },
      select: {
        id: true,
        name: true,
        email: true,
        department: { select: { name: true } },
      },
    }),
    prisma.school.findMany({ where: { isDeleted: false, organizationId: user.organizationId }, select: { id: true, name: true, contactPerson: true, phone: true, whatsapp: true, email: true, city: true, area: true }, orderBy: { name: 'asc' } }),
    prisma.taskType.findMany({ where: { isActive: true, organizationId: user.organizationId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.department.findMany({
      where: { isActive: true, organizationId: user.organizationId },
      select: {
        id: true,
        name: true,
        code: true,
        users: {
          where: { isActive: true, id: { not: user.id }, organizationMemberships: { some: { organizationId: user.organizationId, status: 'ACTIVE' } } },
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <TicketDetailClientView
      ticket={ticket}
      teamMembers={teamMembers}
      departmentsWithUsers={departmentsWithUsers}
      schools={schools}
      taskTypes={taskTypes}
      currentUser={user}
      canAddNote={hasPermission(user, PERMISSIONS.TICKETS_ADD_NOTE)}
      canAcceptReject={hasPermission(user, PERMISSIONS.TICKETS_ACCEPT) && hasPermission(user, PERMISSIONS.TICKETS_REJECT)}
      canContactAttempt={hasPermission(user, PERMISSIONS.TICKETS_CONTACT_ATTEMPT)}
      canClose={hasPermission(user, PERMISSIONS.TICKETS_CLOSE)}
      canTransfer={hasPermission(user, PERMISSIONS.TICKETS_TRANSFER)}
      canDelete={(isPlatformSuperAdmin(user) || user.role === 'SUPER_ADMIN') && hasPermission(user, PERMISSIONS.TICKETS_DELETE)}
      canRequestEdit={hasPermission(user, PERMISSIONS.TICKETS_CORRECTION_REQUEST)}
      canViewAll={hasPermission(user, PERMISSIONS.TICKETS_VIEW_ALL)}
    />
  );
}
