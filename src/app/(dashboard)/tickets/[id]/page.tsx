import { getCurrentUser } from '@/lib/auth/session';
import { TicketService } from '@/server/services/TicketService';
import { notFound } from 'next/navigation';
import { TicketDetailClientView } from '@/components/tickets/TicketDetailClientView';
import prisma from '@/lib/db/prisma';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

export default async function TicketDetailsPage({ params }: { params: { id: string } }) {
  const user = (await getCurrentUser())!;

  let ticket: any;
  try {
    ticket = await TicketService.getTicketById(user, params.id);
  } catch (err: any) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center max-w-xl mx-auto space-y-4 my-12">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Access Restricted</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          You are not an authorized participant for this ticket.
        </p>
        <div className="pt-2">
          <Link
            href="/tickets"
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors inline-block"
          >
            Back to My Tickets
          </Link>
        </div>
      </div>
    );
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
