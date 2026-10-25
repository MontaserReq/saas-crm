import prisma from '@/lib/db/prisma';
import { UserSession } from '@/types';
import { requireOrganizationContext } from '@/lib/auth/organization';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

export class CrmWorkspaceService {
  static async dashboard(user: UserSession, modules?: string[]) {
    const organizationId = (await requireOrganizationContext(user)).id;
    const can = (module: string, permission: string) => (!modules || modules.includes(module)) && hasPermission(user, permission);
    const customers = can('clients', PERMISSIONS.SCHOOLS_VIEW);
    const leadAccess = can('leads', PERMISSIONS.SCHOOLS_VIEW);
    const dealAccess = can('deals', PERMISSIONS.DEALS_VIEW);
    const taskAccess = can('tasks', PERMISSIONS.TASKS_VIEW);
    const pipelineAccess = can('pipelines', PERMISSIONS.PIPELINES_VIEW);
    const entities = [...(customers ? ['Client', 'Contact'] : []), ...(leadAccess ? ['Lead'] : []), ...(dealAccess ? ['Deal'] : []), ...(taskAccess ? ['CrmTask'] : []), ...(pipelineAccess ? ['Pipeline'] : [])];
    const [clients, leads, deals, pipelineValue, openTasks, overdueTasks, recentActivity, upcomingTasks, pipelineSummary] = await Promise.all([
      customers ? prisma.client.count({ where: { organizationId, deletedAt: null } }) : Promise.resolve(0),
      leadAccess ? prisma.lead.count({ where: { organizationId, deletedAt: null, status: { notIn: ['CONVERTED', 'LOST'] } } }) : Promise.resolve(0),
      dealAccess ? prisma.deal.count({ where: { organizationId, deletedAt: null, status: 'OPEN' } }) : Promise.resolve(0),
      dealAccess ? prisma.deal.aggregate({ where: { organizationId, deletedAt: null, status: 'OPEN' }, _sum: { value: true } }) : Promise.resolve({ _sum: { value: null } }),
      taskAccess ? prisma.crmTask.count({ where: { organizationId, deletedAt: null, status: { in: ['TODO', 'IN_PROGRESS'] } } }) : Promise.resolve(0),
      taskAccess ? prisma.crmTask.count({ where: { organizationId, deletedAt: null, status: { in: ['TODO', 'IN_PROGRESS'] }, dueDate: { lt: new Date() } } }) : Promise.resolve(0),
      prisma.auditLog.findMany({ where: { organizationId, entityType: { in: entities } }, orderBy: { createdAt: 'desc' }, take: 10, include: { actor: { select: { id: true, name: true } } } }),
      taskAccess ? prisma.crmTask.findMany({ where: { organizationId, deletedAt: null, status: { in: ['TODO', 'IN_PROGRESS'] }, dueDate: { gte: new Date() } }, orderBy: { dueDate: 'asc' }, take: 10, include: { ...(dealAccess ? { deal: { select: { id: true, title: true } } } : {}), ...(customers ? { client: { select: { id: true, name: true } } } : {}) } }) : Promise.resolve([]),
      pipelineAccess ? prisma.pipeline.findMany({ where: { organizationId, isActive: true }, orderBy: { createdAt: 'asc' }, take: 10, include: { stages: { where: { isActive: true }, orderBy: { order: 'asc' }, include: { _count: { select: { deals: true } } } } } }) : Promise.resolve([]),
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
