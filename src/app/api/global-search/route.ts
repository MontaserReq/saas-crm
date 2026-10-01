import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { z } from 'zod';

const schema = z.object({ q: z.string().trim().min(2).max(80) });
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.organizationId) return NextResponse.json({ error: 'Organization context required' }, { status: 403 });
  if (!hasPermission(user, PERMISSIONS.SEARCH_VIEW)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = schema.safeParse({ q: request.nextUrl.searchParams.get('q') || '' });
  if (!parsed.success) return NextResponse.json({ results: [] });
  const q = parsed.data.q;
  const results: Array<{ type: string; id: string; title: string; subtitle: string; href: string }> = [];
  if (hasPermission(user, PERMISSIONS.SCHOOLS_VIEW)) {
    const schools = await prisma.school.findMany({ where: { organizationId: user.organizationId, isDeleted: false, AND: [{ OR: [{ name: { contains: q, mode: 'insensitive' } }, { city: { contains: q, mode: 'insensitive' } }] }] }, select: { id: true, name: true, city: true }, take: 8 });
    results.push(...schools.map(x => ({ type: 'School', id: x.id, title: x.name, subtitle: x.city, href: `/schools?search=${encodeURIComponent(x.name)}` })));
    const clients = await prisma.client.findMany({ where: { organizationId: user.organizationId, deletedAt: null, OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { phone: { contains: q, mode: 'insensitive' } }] }, select: { id: true, name: true, type: true }, take: 8 });
    results.push(...clients.map(x => ({ type: 'Client', id: x.id, title: x.name, subtitle: x.type, href: `/clients?search=${encodeURIComponent(x.name)}` })));
    const leads = await prisma.lead.findMany({ where: { organizationId: user.organizationId, deletedAt: null, OR: [{ name: { contains: q, mode: 'insensitive' } }, { companyName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] }, select: { id: true, name: true, companyName: true }, take: 6 });
    results.push(...leads.map(x => ({ type: 'Lead', id: x.id, title: x.name, subtitle: x.companyName || 'Lead', href: `/clients?search=${encodeURIComponent(x.name)}` })));
    const contacts = await prisma.contact.findMany({ where: { organizationId: user.organizationId, deletedAt: null, OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] }, select: { id: true, firstName: true, lastName: true, email: true }, take: 6 });
    results.push(...contacts.map(x => ({ type: 'Contact', id: x.id, title: `${x.firstName} ${x.lastName || ''}`.trim(), subtitle: x.email || 'Contact', href: `/clients?search=${encodeURIComponent(x.firstName)}` })));
  }
  if (hasPermission(user, PERMISSIONS.TICKETS_VIEW_ASSIGNED) || hasPermission(user, PERMISSIONS.TICKETS_VIEW_ALL)) {
    const ticketWhere: any = { organizationId: user.organizationId, OR: [{ ticketNumber: { contains: q, mode: 'insensitive' } }, { subject: { contains: q, mode: 'insensitive' } }] };
    if (!hasPermission(user, PERMISSIONS.TICKETS_VIEW_ALL)) ticketWhere.AND = [{ OR: [{ createdById: user.id }, { assignees: { some: { userId: user.id } } }] }];
    const tickets = await prisma.ticket.findMany({ where: ticketWhere, select: { id: true, ticketNumber: true, subject: true }, take: 8 });
    results.push(...tickets.map(x => ({ type: 'Ticket', id: x.id, title: x.ticketNumber, subtitle: x.subject, href: `/tickets/${x.id}` })));
  }
  if (hasPermission(user, PERMISSIONS.USERS_VIEW)) {
    const users = await prisma.user.findMany({ where: { isActive: true, organizationMemberships: { some: { organizationId: user.organizationId, status: 'ACTIVE' } }, OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] }, select: { id: true, name: true, email: true }, take: 6 });
    results.push(...users.map(x => ({ type: 'User', id: x.id, title: x.name, subtitle: x.email, href: '/admin/users' })));
  }
  if (hasPermission(user, PERMISSIONS.DEALS_VIEW)) {
    const deals = await prisma.deal.findMany({ where: { organizationId: user.organizationId, deletedAt: null, OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] }, select: { id: true, title: true, status: true }, take: 8 });
    results.push(...deals.map(x => ({ type: 'Deal', id: x.id, title: x.title, subtitle: x.status, href: `/deals/${x.id}` })));
    const pipelines = await prisma.pipeline.findMany({ where: { organizationId: user.organizationId, isActive: true, name: { contains: q, mode: 'insensitive' } }, select: { id: true, name: true }, take: 5 });
    results.push(...pipelines.map(x => ({ type: 'Pipeline', id: x.id, title: x.name, subtitle: 'Pipeline', href: '/pipelines' })));
  }
  if (hasPermission(user, PERMISSIONS.TASKS_VIEW)) {
    const tasks = await prisma.crmTask.findMany({ where: { organizationId: user.organizationId, deletedAt: null, OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] }, select: { id: true, title: true, status: true }, take: 8 });
    results.push(...tasks.map(x => ({ type: 'Task', id: x.id, title: x.title, subtitle: x.status, href: '/tasks' })));
  }
  return NextResponse.json({ results: results.slice(0, 20) });
}
