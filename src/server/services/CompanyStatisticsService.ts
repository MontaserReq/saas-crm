import prisma from '@/lib/db/prisma';
import { UserSession } from '@/types';
import { requirePlatformAuthority } from './PlanUpgradeService';
import { planFeatureDisplay } from '@/lib/platform/entitlements';

export const CompanyStatisticsService = {
  async list(user: UserSession, search: string, page: number) {
    requirePlatformAuthority(user);
    const where = search ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { slug: { contains: search, mode: 'insensitive' as const } }] } : {};
    const [total, organizations] = await Promise.all([
      prisma.organization.count({ where }),
      prisma.organization.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * 20, take: 20, select: { id: true, name: true, slug: true, isActive: true, createdAt: true, platformSubscription: { select: { status: true, plan: { select: { name: true } } } }, _count: { select: { members: { where: { status: 'ACTIVE', user: { isActive: true } } }, clients: { where: { deletedAt: null } }, deals: { where: { deletedAt: null } }, tickets: true, planUpgradeRequests: { where: { status: 'PENDING' } } } } } }),
    ]);
    return { total, organizations: organizations.map(org => ({ ...org, createdAt: org.createdAt.toISOString() })) };
  },
  async detail(user: UserSession, organizationId: string) {
    requirePlatformAuthority(user);
    const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true, slug: true, isActive: true, createdAt: true, currency: true, timezone: true, language: true, platformSubscription: { include: { plan: true } }, _count: { select: { teams: true, departments: true, pipelines: true, workflows: true, workflowExecutions: true, messages: true, proposals: true, calendarEvents: true, auditLogs: true, researchJobs: true } } } });
    if (!organization) return null;
    const recent = new Date(Date.now() - 30 * 86400000);
    const where = { organizationId };
    const alive = { ...where, deletedAt: null };
    const [clients, leads, contacts, deals, tasks, tickets, members, integrations, attachments, messageAttachments, activity, recentActivity, recentClients, recentDeals, recentTickets, plans] = await Promise.all([
      prisma.client.count({ where: alive }),
      prisma.lead.groupBy({ by: ['status'], where: alive, _count: { _all: true } }),
      prisma.contact.count({ where: alive }),
      prisma.deal.groupBy({ by: ['status', 'currency'], where: alive, _count: { _all: true }, _sum: { value: true } }),
      prisma.crmTask.groupBy({ by: ['status'], where: alive, _count: { _all: true } }),
      prisma.ticket.groupBy({ by: ['status'], where, _count: { _all: true } }),
      prisma.organizationMember.findMany({ where, orderBy: { createdAt: 'asc' }, select: { status: true, lastActiveAt: true, role: { select: { displayName: true } }, user: { select: { id: true, name: true, email: true, isActive: true, lastLoginAt: true } } } }),
      prisma.externalIntegration.findMany({ where, select: { provider: true, accountEmail: true, updatedAt: true } }),
      prisma.attachment.aggregate({ where, _count: { _all: true }, _sum: { size: true } }),
      prisma.messageAttachment.aggregate({ where, _count: { _all: true }, _sum: { size: true } }),
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 15, select: { id: true, action: true, createdAt: true, actor: { select: { name: true } } } }),
      prisma.auditLog.count({ where: { ...where, createdAt: { gte: recent } } }),
      prisma.client.count({ where: { ...alive, createdAt: { gte: recent } } }),
      prisma.deal.count({ where: { ...alive, createdAt: { gte: recent } } }),
      prisma.ticket.count({ where: { ...where, createdAt: { gte: recent } } }),
      prisma.platformPlan.findMany({ where: { isActive: true }, orderBy: { monthlyPrice: 'asc' }, select: { id: true, name: true, userLimit: true } }),
    ]);
    const subscription = organization.platformSubscription;
    const activeMembers = members.filter(member => member.status === 'ACTIVE' && member.user.isActive).length;
    const statusCounts = (rows: Array<{ status: string; _count: { _all: number } }>) => rows.map(row => ({ status: row.status, count: row._count._all }));
    return {
      organization: { id: organization.id, name: organization.name, slug: organization.slug, isActive: organization.isActive, currency: organization.currency, timezone: organization.timezone, language: organization.language, createdAt: organization.createdAt.toISOString() },
      subscription: subscription ? { planId: subscription.planId, plan: subscription.plan.name, status: subscription.status, billingInterval: subscription.billingInterval, userLimit: subscription.plan.userLimit, endsAt: subscription.endsAt?.toISOString() ?? null, features: planFeatureDisplay(subscription.plan.features) } : null,
      counts: { ...organization._count, clients, contacts, leads: leads.reduce((total, row) => total + row._count._all, 0), deals: deals.reduce((total, row) => total + row._count._all, 0), tasks: tasks.reduce((total, row) => total + row._count._all, 0), tickets: tickets.reduce((total, row) => total + row._count._all, 0), members: members.length, activeMembers, integrations: integrations.length, files: attachments._count._all + messageAttachments._count._all },
      storageBytes: (attachments._sum.size ?? 0) + (messageAttachments._sum.size ?? 0),
      recent: { activity: recentActivity, clients: recentClients, deals: recentDeals, tickets: recentTickets },
      statuses: { leads: statusCounts(leads), tasks: statusCounts(tasks), tickets: statusCounts(tickets) },
      sales: deals.map(row => ({ status: row.status, currency: row.currency, count: row._count._all, value: Number(row._sum.value ?? 0) })),
      members: members.map(member => ({ ...member.user, status: member.status, role: member.role?.displayName ?? '', lastLoginAt: member.user.lastLoginAt?.toISOString() ?? null, lastActiveAt: member.lastActiveAt?.toISOString() ?? null })),
      integrations: integrations.map(item => ({ ...item, updatedAt: item.updatedAt.toISOString() })),
      activity: activity.map(item => ({ ...item, createdAt: item.createdAt.toISOString() })), plans,
    };
  },
};

export type CompanyStatistics = NonNullable<Awaited<ReturnType<typeof CompanyStatisticsService.detail>>>;
