import prisma from '@/lib/db/prisma';
import { UserSession } from '@/types';
import { requireOrganizationContext } from '@/lib/auth/organization';
import { AuditService } from './AuditService';
import { CustomFieldService } from './CustomFieldService';
import { WorkflowService } from './WorkflowService';

export interface LeadInput { name: string; companyName?: string | null; email?: string | null; phone?: string | null; source?: string | null; status?: string; notes?: string | null; clientId?: string | null; assignedUserId?: string | null; assignedTeamId?: string | null; customFields?: Record<string, unknown>; }
export interface LeadConversionInput { clientId?: string; client?: { name: string; type?: string; email?: string | null; phone?: string | null; description?: string | null }; contact?: { firstName: string; lastName?: string | null; jobTitle?: string | null; email?: string | null; phone?: string | null; mobile?: string | null; notes?: string | null }; contactId?: string; }
const clean = (value?: string | null) => value?.trim() || null;

export class LeadService {
  private static async validateRelations(organizationId: string, input: LeadInput) {
    if (input.clientId && !(await prisma.client.findFirst({ where: { id: input.clientId, organizationId, deletedAt: null }, select: { id: true } }))) throw new Error('Client not found in the active organization');
    if (input.assignedUserId && !(await prisma.organizationMember.findFirst({ where: { organizationId, userId: input.assignedUserId, status: 'ACTIVE' }, select: { id: true } }))) throw new Error('Assigned user is not in the active organization');
    if (input.assignedTeamId && !(await prisma.team.findFirst({ where: { id: input.assignedTeamId, organizationId }, select: { id: true } }))) throw new Error('Assigned team is not in the active organization');
  }
  static async list(user: UserSession, filter: { search?: string; status?: string } = {}) {
    const organizationId = (await requireOrganizationContext(user)).id; const where: any = { organizationId, deletedAt: null, ...(filter.status ? { status: filter.status } : {}) };
    if (filter.search?.trim()) { const q = filter.search.trim(); where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { companyName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { phone: { contains: q, mode: 'insensitive' } }]; }
    return prisma.lead.findMany({ where, orderBy: { createdAt: 'desc' }, include: { client: true, assignedUser: { select: { id: true, name: true, email: true } }, assignedTeam: true } });
  }
  static async get(user: UserSession, id: string) { const organizationId = (await requireOrganizationContext(user)).id; return prisma.lead.findFirst({ where: { id, organizationId, deletedAt: null }, include: { client: true, assignedUser: true, assignedTeam: true, convertedContact: true, deals: { where: { deletedAt: null }, include: { pipeline: true, stage: true } }, crmTasks: { where: { deletedAt: null }, orderBy: { dueDate: 'asc' } } } }); }
  static async create(user: UserSession, input: LeadInput) { const organizationId = (await requireOrganizationContext(user)).id; if (!input.name?.trim()) throw new Error('Lead name is required'); await this.validateRelations(organizationId, input); const lead = await prisma.lead.create({ data: { organizationId, name: input.name.trim(), companyName: clean(input.companyName), email: clean(input.email), phone: clean(input.phone), source: clean(input.source), status: input.status || 'NEW', notes: clean(input.notes), clientId: input.clientId || null, assignedUserId: input.assignedUserId || null, assignedTeamId: input.assignedTeamId || null } }); if (input.customFields) await CustomFieldService.setValues(user, 'LEAD', lead.id, input.customFields); await AuditService.logAudit({ actorId: user.id, organizationId, action: 'LEAD_CREATED', entityType: 'Lead', entityId: lead.id }); void WorkflowService.dispatch({ eventId: `Lead:${lead.id}:RECORD_CREATED`, organizationId, entityType: 'LEAD', entityId: lead.id, eventType: 'RECORD_CREATED', actorId: user.id }).catch(console.error); return lead; }
  static async update(user: UserSession, id: string, input: Partial<LeadInput>) { const organizationId = (await requireOrganizationContext(user)).id; const existing = await prisma.lead.findFirst({ where: { id, organizationId, deletedAt: null } }); if (!existing) throw new Error('Lead not found'); await this.validateRelations(organizationId, input as LeadInput); const data: any = {}; for (const key of ['name', 'companyName', 'email', 'phone', 'source', 'status', 'notes', 'clientId', 'assignedUserId', 'assignedTeamId'] as const) if (input[key] !== undefined) data[key] = ['name', 'status'].includes(key) ? input[key] : (typeof input[key] === 'string' ? clean(input[key]) : input[key]); const lead = await prisma.lead.update({ where: { id }, data }); if (input.customFields) await CustomFieldService.setValues(user, 'LEAD', id, input.customFields); await AuditService.logAudit({ actorId: user.id, organizationId, action: 'LEAD_UPDATED', entityType: 'Lead', entityId: id }); void WorkflowService.dispatch({ eventId: `Lead:${id}:RECORD_UPDATED:${lead.updatedAt.toISOString()}`, organizationId, entityType: 'LEAD', entityId: id, eventType: input.status && input.status !== existing.status ? 'LEAD_STATUS_CHANGED' : 'RECORD_UPDATED', actorId: user.id }).catch(console.error); return lead; }
  static async delete(user: UserSession, id: string) { const organizationId = (await requireOrganizationContext(user)).id; const existing = await prisma.lead.findFirst({ where: { id, organizationId, deletedAt: null } }); if (!existing) throw new Error('Lead not found'); return prisma.lead.update({ where: { id }, data: { status: 'LOST', deletedAt: new Date() } }); }

  static async findConversionDuplicates(user: UserSession, id: string) {
    const organizationId = (await requireOrganizationContext(user)).id;
    const lead = await prisma.lead.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!lead) throw new Error('Lead not found');
    const clients = await prisma.client.findMany({ where: { organizationId, deletedAt: null, OR: [{ email: lead.email || undefined }, { phone: lead.phone || undefined }, { name: lead.companyName || lead.name }] }, select: { id: true, name: true, email: true, phone: true, type: true }, take: 10 });
    const contacts = await prisma.contact.findMany({ where: { organizationId, deletedAt: null, OR: [{ email: lead.email || undefined }, { phone: lead.phone || undefined }] }, select: { id: true, firstName: true, lastName: true, email: true, phone: true, clientId: true }, take: 10 });
    return { clients, contacts };
  }

  static async convert(user: UserSession, id: string, input: LeadConversionInput) {
    const organizationId = (await requireOrganizationContext(user)).id;
    return prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirst({ where: { id, organizationId, deletedAt: null } });
      if (!lead) throw new Error('Lead not found');
      if (lead.status === 'CONVERTED' || lead.convertedClientId) throw new Error('Lead has already been converted');
      let clientId = input.clientId || null;
      if (clientId) {
        const existingClient = await tx.client.findFirst({ where: { id: clientId, organizationId, deletedAt: null }, select: { id: true } });
        if (!existingClient) throw new Error('Selected client does not belong to the active organization');
      } else {
        const duplicates = await tx.client.findMany({ where: { organizationId, deletedAt: null, OR: [{ email: lead.email || undefined }, { phone: lead.phone || undefined }, { name: lead.companyName || lead.name }] }, select: { id: true, name: true }, take: 10 });
        if (duplicates.length) throw new Error(`Possible existing client found; choose an existing client or explicitly create a new one: ${duplicates.map(x => `${x.id}:${x.name}`).join(', ')}`);
        const created = await tx.client.create({ data: { organizationId, name: input.client?.name || lead.companyName || lead.name, type: input.client?.type || 'OTHER', email: input.client?.email || lead.email, phone: input.client?.phone || lead.phone, description: input.client?.description || lead.notes, createdById: user.id } });
        clientId = created.id;
      }
      let contactId = input.contactId || null;
      if (contactId) {
        const contact = await tx.contact.findFirst({ where: { id: contactId, organizationId, deletedAt: null }, select: { id: true } });
        if (!contact) throw new Error('Selected contact does not belong to the active organization');
      } else {
        const contact = await tx.contact.create({ data: { organizationId, clientId, firstName: input.contact?.firstName || lead.name, lastName: input.contact?.lastName || null, jobTitle: input.contact?.jobTitle || null, email: input.contact?.email || lead.email, phone: input.contact?.phone || lead.phone, mobile: input.contact?.mobile || null, notes: input.contact?.notes || lead.notes, isPrimary: true } });
        contactId = contact.id;
      }
      const updated = await tx.lead.update({ where: { id }, data: { status: 'CONVERTED', clientId, convertedClientId: clientId, convertedContactId: contactId } });
      await tx.auditLog.create({ data: { organizationId, actorId: user.id, action: 'LEAD_CONVERTED', entityType: 'Lead', entityId: id, metadata: JSON.stringify({ clientId, contactId }) } });
      return { lead: updated, clientId, contactId };
    });
  }
}
