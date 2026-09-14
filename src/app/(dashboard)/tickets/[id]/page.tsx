import { getCurrentUser } from '@/lib/auth/session';
import { TicketService } from '@/server/services/TicketService';
import { notFound } from 'next/navigation';
import { TicketDetailClientView } from '@/components/tickets/TicketDetailClientView';
import prisma from '@/lib/db/prisma';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { TicketAccessRestricted } from '@/components/tickets/TicketAccessRestricted';

export default async function TicketDetailsPage({ params }: { params: { id: string } }) {
  const user = (await getCurrentUser())!;

  let ticket: any;
  try {
    ticket = await TicketService.getTicketById(user, params.id);
  } catch (err: any) {
    return <TicketAccessRestricted />;
  }

  if (!ticket) {
    notFound();
  }

  const [teamMembers, departmentsWithUsers] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, id: { not: user.id } },
      select: {
        id: true,
        name: true,
        email: true,
        department: { select: { name: true } },
      },
    }),
    prisma.department.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        users: {
          where: { isActive: true, id: { not: user.id } },
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
      currentUser={user}
      canDelete={user.role === 'SUPER_ADMIN' && hasPermission(user, PERMISSIONS.TICKETS_DELETE)}
    />
  );
}
