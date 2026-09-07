import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { z } from 'zod';

const schema = z.object({ q: z.string().trim().min(2).max(80) });
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(user, PERMISSIONS.SEARCH_VIEW)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = schema.safeParse({ q: request.nextUrl.searchParams.get('q') || '' });
  if (!parsed.success) return NextResponse.json({ results: [] });
  const q = parsed.data.q;
  const results: Array<{ type: string; id: string; title: string; subtitle: string; href: string }> = [];
  if (hasPermission(user, PERMISSIONS.SCHOOLS_VIEW)) {
    const schools = await prisma.school.findMany({ where: { isDeleted: false, AND: [{ OR: [{ name: { contains: q, mode: 'insensitive' } }, { city: { contains: q, mode: 'insensitive' } }] }] }, select: { id: true, name: true, city: true }, take: 8 });
    results.push(...schools.map(x => ({ type: 'School', id: x.id, title: x.name, subtitle: x.city, href: `/schools?search=${encodeURIComponent(x.name)}` })));
  }
  if (hasPermission(user, PERMISSIONS.TICKETS_VIEW_ASSIGNED) || hasPermission(user, PERMISSIONS.TICKETS_VIEW_ALL)) {
    const ticketWhere: any = { OR: [{ ticketNumber: { contains: q, mode: 'insensitive' } }, { subject: { contains: q, mode: 'insensitive' } }] };
    if (!hasPermission(user, PERMISSIONS.TICKETS_VIEW_ALL)) ticketWhere.AND = [{ OR: [{ createdById: user.id }, { assignees: { some: { userId: user.id } } }] }];
    const tickets = await prisma.ticket.findMany({ where: ticketWhere, select: { id: true, ticketNumber: true, subject: true }, take: 8 });
    results.push(...tickets.map(x => ({ type: 'Ticket', id: x.id, title: x.ticketNumber, subtitle: x.subject, href: `/tickets/${x.id}` })));
  }
  if (hasPermission(user, PERMISSIONS.USERS_VIEW)) {
    const users = await prisma.user.findMany({ where: { isActive: true, OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] }, select: { id: true, name: true, email: true }, take: 6 });
    results.push(...users.map(x => ({ type: 'User', id: x.id, title: x.name, subtitle: x.email, href: '/admin/users' })));
  }
  return NextResponse.json({ results: results.slice(0, 20) });
}
