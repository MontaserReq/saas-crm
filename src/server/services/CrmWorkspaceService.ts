import prisma from '@/lib/db/prisma';
import { UserSession } from '@/types';
import { requireOrganizationContext } from '@/lib/auth/organization';

export class CrmWorkspaceService {
  static async dashboard(user: UserSession) {
    const organizationId = (await requireOrganizationContext(user)).id;
    const [clients, leads, deals, pipelineValue, openTasks, overdueTasks, recentActivity, upcomingTasks, pipelineSummary] = await Promise.all([
      prisma.client.count({ where: { organizationId, deletedAt: null } }),
      prisma.lead.count({ where: { organizationId, deletedAt: null, status: { notIn: ['CONVERTED', 'LOST'] } } }),
      prisma.deal.count({ where: { organizationId, deletedAt: null, status: 'OPEN' } }),
      prisma.deal.aggregate({ where: { organizationId, deletedAt: null, status: 'OPEN' }, _sum: { value: true } }),
      prisma.crmTask.count({ where: { organizationId, deletedAt: null, status: { in: ['TODO', 'IN_PROGRESS'] } } }),
      prisma.crmTask.count({ where: { organizationId, deletedAt: null, status: { in: ['TODO', 'IN_PROGRESS'] }, dueDate: { lt: new Date() } } }),
      prisma.auditLog.findMany({ where: { organizationId, entityType: { in: ['Client', 'Lead', 'Contact', 'Deal', 'CrmTask', 'Pipeline'] } }, orderBy: { createdAt: 'desc' }, take: 10, include: { actor: { select: { id: true, name: true } } } }),
      prisma.crmTask.findMany({ where: { organizationId, deletedAt: null, status: { in: ['TODO', 'IN_PROGRESS'] }, dueDate: { gte: new Date() } }, orderBy: { dueDate: 'asc' }, take: 10, include: { deal: { select: { id: true, title: true } }, client: { select: { id: true, name: true } } } }),
      prisma.pipeline.findMany({ where: { organizationId, isActive: true }, orderBy: { createdAt: 'asc' }, take: 10, include: { stages: { where: { isActive: true }, orderBy: { order: 'asc' }, include: { _count: { select: { deals: true } } } } } }),
    ]);
    return { counts: { clients, leads, deals, pipelineValue: pipelineValue._sum.value?.toString() || '0', openTasks, overdueTasks }, recentActivity, upcomingTasks, pipelineSummary };
  }

  static async timeline(user: UserSession, entityType: string, entityId: string, page = 1, pageSize = 25) {
    const organizationId = (await requireOrganizationContext(user)).id;
    const where = { organizationId, entityType, entityId };
    const [total, events] = await Promise.all([prisma.auditLog.count({ where }), prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { actor: { select: { id: true, name: true } } } })]);
    return { events, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }
}
