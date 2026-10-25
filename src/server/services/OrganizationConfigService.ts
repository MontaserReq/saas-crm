import prisma from '@/lib/db/prisma';
import { UserSession } from '@/types';
import { requireOrganizationContext } from '@/lib/auth/organization';
import { AuditService } from './AuditService';
import { isValidBrandColor, normalizeBrandColor } from '@/lib/branding';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getStorageProvider } from '@/lib/storage';
import { validateAttachmentContent } from '@/lib/storage/attachmentPolicy';

export const DEFAULT_MODULES = ['dashboard', 'clients', 'leads', 'contacts', 'deals', 'pipelines', 'tasks', 'tickets', 'calendar', 'proposals', 'activities', 'reports'];
export const DEFAULT_CLIENT_TYPES = ['SCHOOL', 'COMPANY', 'NGO', 'UNIVERSITY', 'GOVERNMENT', 'INDIVIDUAL', 'OTHER'];
export const DEFAULT_LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST'];
export const APPROVAL_RESOURCES = ['CLIENT', 'LEAD', 'CONTACT', 'DEAL', 'TASK', 'CALENDAR_EVENT', 'DEPARTMENT'] as const;
export const APPROVAL_OPERATIONS = ['CREATE', 'UPDATE', 'DELETE'] as const;
export type ApprovalRules = Record<(typeof APPROVAL_RESOURCES)[number], Record<(typeof APPROVAL_OPERATIONS)[number], boolean>>;
export const DEFAULT_APPROVAL_RULES = Object.fromEntries(
  APPROVAL_RESOURCES.map((resource) => [resource, { CREATE: false, UPDATE: false, DELETE: false }]),
) as ApprovalRules;
export const DEFAULT_TICKET_PRIORITIES = [
  { key: 'LOW', label: 'Normal', labelAr: 'عادية', active: true },
  { key: 'MEDIUM', label: 'Important', labelAr: 'مهمة', active: true },
  { key: 'HIGH', label: 'Very important', labelAr: 'مهمة جداً', active: true },
  { key: 'URGENT', label: 'Urgent', labelAr: 'عاجلة جداً', active: true },
] as const;
const json = <T>(value: string | null | undefined, fallback: T): T => { try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } };

export class OrganizationConfigService {
  static async get(user: UserSession) {
    const organizationId = (await requireOrganizationContext(user)).id;
    const [organization, settings] = await Promise.all([
      prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
      prisma.organizationSettings.upsert({ where: { organizationId }, create: { organizationId, enabledModules: JSON.stringify(DEFAULT_MODULES), clientTypes: JSON.stringify(DEFAULT_CLIENT_TYPES), leadStatuses: JSON.stringify(DEFAULT_LEAD_STATUSES), ticketPriorities: JSON.stringify(DEFAULT_TICKET_PRIORITIES) }, update: {} }),
    ]);
    const parsedTicketPriorities = json(settings.ticketPriorities, DEFAULT_TICKET_PRIORITIES);
    const ticketPriorities = Array.isArray(parsedTicketPriorities) && parsedTicketPriorities.length > 0 ? parsedTicketPriorities : DEFAULT_TICKET_PRIORITIES;
    const storedRules = json<Partial<ApprovalRules>>(settings.approvalRules, {});
    const approvalRules = Object.fromEntries(APPROVAL_RESOURCES.map((resource) => [resource, { ...DEFAULT_APPROVAL_RULES[resource], ...(storedRules[resource] || {}) }])) as ApprovalRules;
    return { organization, settings: { ...settings, enabledModules: json(settings.enabledModules, DEFAULT_MODULES), clientTypes: json(settings.clientTypes, DEFAULT_CLIENT_TYPES), leadStatuses: json(settings.leadStatuses, DEFAULT_LEAD_STATUSES), ticketStatuses: json(settings.ticketStatuses, []), ticketPriorities, approvalRules } };
  }

  static async updateOrganization(user: UserSession, input: Partial<{ name: string; primaryColor: string | null; language: string; timezone: string; currency: string; dateFormat: string }>) {
    const organizationId = (await requireOrganizationContext(user)).id;
    if (input.name !== undefined && !input.name.trim()) throw new Error('Organization name is required');
    if (input.language !== undefined && !['en', 'ar'].includes(input.language)) throw new Error('Unsupported language');
    if (input.currency !== undefined && !/^[A-Z]{3}$/.test(input.currency)) throw new Error('Currency must be a three-letter ISO code');
    if (input.timezone !== undefined) { try { Intl.DateTimeFormat('en-US', { timeZone: input.timezone }).format(); } catch { throw new Error('Invalid timezone'); } }
    if (input.primaryColor !== undefined && input.primaryColor !== null && !isValidBrandColor(input.primaryColor)) throw new Error('Brand color must be a six-digit hex color');
    const organization = await prisma.organization.update({ where: { id: organizationId }, data: { ...(input.name !== undefined ? { name: input.name.trim() } : {}), ...(input.primaryColor !== undefined ? { primaryColor: input.primaryColor === null ? null : normalizeBrandColor(input.primaryColor) } : {}), ...(input.language !== undefined ? { language: input.language } : {}), ...(input.timezone !== undefined ? { timezone: input.timezone } : {}), ...(input.currency !== undefined ? { currency: input.currency } : {}) } });
    if (input.dateFormat !== undefined) await prisma.organizationSettings.upsert({ where: { organizationId }, create: { organizationId, dateFormat: input.dateFormat }, update: { dateFormat: input.dateFormat } });
    await AuditService.logAudit({ actorId: user.id, organizationId, action: 'ORGANIZATION_SETTINGS_UPDATED', entityType: 'Organization', entityId: organizationId, metadata: { fields: Object.keys(input) } });
    return organization;
  }

  static async uploadLogo(user: UserSession, fileBuffer: Buffer, originalName: string, mimeType: string) {
    if (!hasPermission(user, PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE)) throw new Error('Forbidden');
    const organizationId = (await requireOrganizationContext(user)).id;
    if (!fileBuffer.length || fileBuffer.length > 5 * 1024 * 1024) throw new Error('Logo must be a non-empty image no larger than 5MB');

    const inspected = validateAttachmentContent({ name: originalName, type: mimeType, size: fileBuffer.length }, fileBuffer);
    if (inspected.error || !['image/png', 'image/jpeg', 'image/webp'].includes(inspected.mimeType)) {
      throw new Error('Invalid logo. Allowed formats: PNG, JPG, WebP');
    }

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { logoKey: true, logoProvider: true },
    });
    const storage = getStorageProvider();
    const uploaded = await storage.upload(fileBuffer, originalName, inspected.mimeType, {
      keyPrefix: `${organizationId}/organization/logo`,
    });

    try {
      await prisma.organization.update({
        where: { id: organizationId },
        data: { logoKey: uploaded.storageKey, logoProvider: storage.providerId },
      });
    } catch (error) {
      await storage.delete(uploaded.storageKey).catch(() => false);
      throw error;
    }

    if (organization.logoKey) {
      await getStorageProvider(organization.logoProvider as 'local' | 's3').delete(organization.logoKey).catch(() => false);
    }
    await AuditService.logAudit({ actorId: user.id, organizationId, action: 'ORGANIZATION_LOGO_UPDATED', entityType: 'Organization', entityId: organizationId });
    return { logoKey: uploaded.storageKey, logoProvider: storage.providerId };
  }

  static async removeLogo(user: UserSession) {
    if (!hasPermission(user, PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE)) throw new Error('Forbidden');
    const organizationId = (await requireOrganizationContext(user)).id;
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { logoKey: true, logoProvider: true },
    });
    await prisma.organization.update({ where: { id: organizationId }, data: { logoKey: null, logoProvider: 'local' } });
    if (organization.logoKey) {
      await getStorageProvider(organization.logoProvider as 'local' | 's3').delete(organization.logoKey).catch(() => false);
    }
    await AuditService.logAudit({ actorId: user.id, organizationId, action: 'ORGANIZATION_LOGO_REMOVED', entityType: 'Organization', entityId: organizationId });
  }

  static async updateLists(user: UserSession, input: { enabledModules?: string[]; clientTypes?: string[]; leadStatuses?: string[]; ticketPriorities?: Array<{ key: string; label: string; labelAr: string; active?: boolean }>; approvalRules?: ApprovalRules }) {
    const organizationId = (await requireOrganizationContext(user)).id;
    if (input.enabledModules && input.enabledModules.some((x) => !DEFAULT_MODULES.includes(x))) throw new Error('Unsupported module');
    if (input.clientTypes) {
      if (input.clientTypes.length === 0) throw new Error('At least one client type is required');
      if (input.clientTypes.some((x) => !x.trim() || x.trim().length > 40 || /[\u0000-\u001f\u007f]/.test(x))) throw new Error('Invalid client type');
      input.clientTypes = input.clientTypes.map((x) => x.trim().replace(/\s+/g, ' '));
    }
    if (input.leadStatuses && input.leadStatuses.some((x) => !/^[A-Z][A-Z0-9_]{1,31}$/.test(x))) throw new Error('Invalid lead status');
    if (input.ticketPriorities) {
      if (!input.ticketPriorities.length || !input.ticketPriorities.some((item) => item.active !== false) || input.ticketPriorities.some((item) => !/^(LOW|MEDIUM|HIGH|URGENT)$/.test(item.key) || !item.label.trim() || !item.labelAr.trim())) throw new Error('Invalid ticket priority configuration');
    }
    if (input.approvalRules) {
      const keys = Object.keys(input.approvalRules);
      if (keys.some((key) => !APPROVAL_RESOURCES.includes(key as any))) throw new Error('Unsupported approval resource');
      for (const resource of APPROVAL_RESOURCES) {
        const rule = input.approvalRules[resource];
        if (!rule || APPROVAL_OPERATIONS.some((operation) => typeof rule[operation] !== 'boolean')) throw new Error('Invalid approval rules');
      }
    }
    const data = { ...(input.enabledModules ? { enabledModules: JSON.stringify([...new Set(input.enabledModules)]) } : {}), ...(input.clientTypes ? { clientTypes: JSON.stringify([...new Set(input.clientTypes)]) } : {}), ...(input.leadStatuses ? { leadStatuses: JSON.stringify([...new Set(input.leadStatuses)]) } : {}), ...(input.ticketPriorities ? { ticketPriorities: JSON.stringify(input.ticketPriorities) } : {}), ...(input.approvalRules ? { approvalRules: JSON.stringify(input.approvalRules) } : {}) };
    const settings = await prisma.organizationSettings.upsert({ where: { organizationId }, create: { organizationId, enabledModules: JSON.stringify(input.enabledModules || DEFAULT_MODULES), clientTypes: JSON.stringify(input.clientTypes || DEFAULT_CLIENT_TYPES), leadStatuses: JSON.stringify(input.leadStatuses || DEFAULT_LEAD_STATUSES), ticketPriorities: JSON.stringify(input.ticketPriorities || DEFAULT_TICKET_PRIORITIES) }, update: data });
    await AuditService.logAudit({ actorId: user.id, organizationId, action: 'ORGANIZATION_CONFIGURATION_UPDATED', entityType: 'OrganizationSettings', entityId: settings.id, metadata: { fields: Object.keys(input) } });
    return settings;
  }
}
