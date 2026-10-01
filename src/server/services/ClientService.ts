import prisma from '@/lib/db/prisma';
import { UserSession } from '@/types';
import { requireOrganizationContext } from '@/lib/auth/organization';
import { AuditService } from './AuditService';
import { CustomFieldService } from './CustomFieldService';
import { WorkflowService } from './WorkflowService';

export type ClientType = 'SCHOOL' | 'COMPANY' | 'NGO' | 'UNIVERSITY' | 'GOVERNMENT' | 'INDIVIDUAL' | 'OTHER';
export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'PROSPECT' | 'ARCHIVED';

export interface ClientInput {
  name: string;
  type?: ClientType;
  status?: ClientStatus;
  description?: string | null;
  category?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  customFields?: Record<string, unknown>;
}

function clean(value?: string | null) { return value?.trim() || null; }

export class ClientService {
  static async list(user: UserSession, filter: { search?: string; type?: ClientType; status?: ClientStatus } = {}) {
    const organizationId = (await requireOrganizationContext(user)).id;
    const where: any = { organizationId, deletedAt: null };
    if (filter.type) where.type = filter.type;
    if (filter.status) where.status = filter.status;
    if (filter.search?.trim()) {
      const q = filter.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
      ];
    }
    return prisma.client.findMany({ where, orderBy: { createdAt: 'desc' }, include: { contacts: { where: { deletedAt: null }, orderBy: { isPrimary: 'desc' }, take: 5 }, _count: { select: { tickets: true, proposals: true, contacts: true } } } });
  }

  static async get(user: UserSession, id: string) {
    const organizationId = (await requireOrganizationContext(user)).id;
    return prisma.client.findFirst({ where: { id, organizationId, deletedAt: null }, include: { contacts: { where: { deletedAt: null }, orderBy: { isPrimary: 'desc' } }, leads: { where: { deletedAt: null } }, deals: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 50, include: { stage: true, pipeline: true, owner: { select: { id: true, name: true } } } }, crmTasks: { where: { deletedAt: null }, orderBy: { dueDate: 'asc' }, take: 50, include: { assignedUser: { select: { id: true, name: true } }, deal: { select: { id: true, title: true } } } }, tickets: { orderBy: { createdAt: 'desc' }, take: 25, select: { id: true, ticketNumber: true, subject: true, status: true, createdAt: true } }, proposals: { orderBy: { createdAt: 'desc' }, take: 25, select: { id: true, title: true, status: true, createdAt: true } }, calendarEvents: { orderBy: { startDate: 'asc' }, take: 25, select: { id: true, title: true, startDate: true, type: true } }, _count: { select: { tickets: true, proposals: true, calendarEvents: true, deals: true, crmTasks: true } } } });
  }

  static async create(user: UserSession, input: ClientInput) {
    const organizationId = (await requireOrganizationContext(user)).id;
    if (!input.name?.trim()) throw new Error('Client name is required');
    const client = await prisma.client.create({ data: { organizationId, name: input.name.trim(), type: input.type || 'OTHER', status: input.status || 'ACTIVE', description: clean(input.description), category: clean(input.category), website: clean(input.website), email: clean(input.email), phone: clean(input.phone), address: clean(input.address), createdById: user.id } });
    if (input.customFields) await CustomFieldService.setValues(user, 'CLIENT', client.id, input.customFields);
    await AuditService.logAudit({ actorId: user.id, organizationId, action: 'CLIENT_CREATED', entityType: 'Client', entityId: client.id, metadata: { type: client.type } });
    void WorkflowService.dispatch({ eventId: `Client:${client.id}:RECORD_CREATED`, organizationId, entityType: 'CLIENT', entityId: client.id, eventType: 'RECORD_CREATED', actorId: user.id }).catch(console.error);
    return client;
  }

  static async update(user: UserSession, id: string, input: Partial<ClientInput>) {
    const organizationId = (await requireOrganizationContext(user)).id;
    const existing = await prisma.client.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!existing) throw new Error('Client not found');
    const data: any = { updatedById: user.id };
    for (const key of ['name', 'type', 'status'] as const) if (input[key] !== undefined) data[key] = typeof input[key] === 'string' ? input[key]!.trim() : input[key];
    for (const key of ['description', 'category', 'website', 'email', 'phone', 'address'] as const) if (input[key] !== undefined) data[key] = clean(input[key]);
    const client = await prisma.client.update({ where: { id }, data });
    if (input.customFields) await CustomFieldService.setValues(user, 'CLIENT', id, input.customFields);
    await AuditService.logAudit({ actorId: user.id, organizationId, action: 'CLIENT_UPDATED', entityType: 'Client', entityId: id });
    void WorkflowService.dispatch({ eventId: `Client:${id}:RECORD_UPDATED:${client.updatedAt.toISOString()}`, organizationId, entityType: 'CLIENT', entityId: id, eventType: 'RECORD_UPDATED', actorId: user.id }).catch(console.error);
    return client;
  }

  static async delete(user: UserSession, id: string) {
    const organizationId = (await requireOrganizationContext(user)).id;
    const existing = await prisma.client.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!existing) throw new Error('Client not found');
    const client = await prisma.client.update({ where: { id }, data: { status: 'ARCHIVED', deletedAt: new Date(), updatedById: user.id } });
    await AuditService.logAudit({ actorId: user.id, organizationId, action: 'CLIENT_ARCHIVED', entityType: 'Client', entityId: id });
    return client;
  }
}
