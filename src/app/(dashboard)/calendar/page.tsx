import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { CalendarService } from '@/server/services/CalendarService';
import { CalendarClientView } from '@/components/calendar/CalendarClientView';
import prisma from '@/lib/db/prisma';

export default async function CalendarPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const [events, schools, tickets, users] = await Promise.all([
    CalendarService.getCalendarEvents(user),
    prisma.school.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.ticket.findMany({
      where: { status: { notIn: ['CLOSED', 'REJECTED'] } },
      select: { id: true, ticketNumber: true, subject: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <CalendarClientView
      events={events}
      schools={schools}
      tickets={tickets}
      users={users}
    />
  );
}
