import prisma from '@/lib/db/prisma';
import { UserSession } from '@/types';
import { requireOrganizationContext } from '@/lib/auth/organization';
import { AuditService } from './AuditService';

export const DEFAULT_MODULES = ['dashboard', 'clients', 'leads', 'contacts', 'deals', 'pipelines', 'tasks', 'tickets', 'calendar', 'proposals', 'activities', 'reports'];
export const DEFAULT_CLIENT_TYPES = ['SCHOOL', 'COMPANY', 'NGO', 'UNIVERSITY', 'GOVERNMENT', 'INDIVIDUAL', 'OTHER'];
export const DEFAULT_LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST'];
const json = <T>(value: string | null | undefined, fallback: T): T => { try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } };

export class OrganizationConfigService {
  static async get(user: UserSession) {
    const organizationId = (await requireOrganizationContext(user)).id;
    const [organization, settings] = await Promise.all([
      prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
      prisma.organizationSettings.upsert({ where: { organizationId }, create: { organizationId, enabledModules: JSON.stringify(DEFAULT_MODULES), clientTypes: JSON.stringify(DEFAULT_CLIENT_TYPES), leadStatuses: JSON.stringify(DEFAULT_LEAD_STATUSES) }, update: {} }),
    ]);
    return { organization, settings: { ...settings, enabledModules: json(settings.enabledModules, DEFAULT_MODULES), clientTypes: json(settings.clientTypes, DEFAULT_CLIENT_TYPES), leadStatuses: json(settings.leadStatuses, DEFAULT_LEAD_STATUSES), ticketStatuses: json(settings.ticketStatuses, []) } };
  }

  static async updateOrganization(user: UserSession, input: Partial<{ name: string; primaryColor: string | null; language: string; timezone: string; currency: string; dateFormat: string }>) {
    const organizationId = (await requireOrganizationContext(user)).id;
    if (input.name !== undefined && !input.name.trim()) throw new Error('Organization name is required');
    if (input.language !== undefined && !['en', 'ar'].includes(input.language)) throw new Error('Unsupported language');
    if (input.currency !== undefined && !/^[A-Z]{3}$/.test(input.currency)) throw new Error('Currency must be a three-letter ISO code');
    if (input.timezone !== undefined) { try { Intl.DateTimeFormat('en-US', { timeZone: input.timezone }).format(); } catch { throw new Error('Invalid timezone'); } }
    const organization = await prisma.organization.update({ where: { id: organizationId }, data: { ...(input.name !== undefined ? { name: input.name.trim() } : {}), ...(input.primaryColor !== undefined ? { primaryColor: input.primaryColor } : {}), ...(input.language !== undefined ? { language: input.language } : {}), ...(input.timezone !== undefined ? { timezone: input.timezone } : {}), ...(input.currency !== undefined ? { currency: input.currency } : {}) } });
    if (input.dateFormat !== undefined) await prisma.organizationSettings.upsert({ where: { organizationId }, create: { organizationId, dateFormat: input.dateFormat }, update: { dateFormat: input.dateFormat } });
    await AuditService.logAudit({ actorId: user.id, organizationId, action: 'ORGANIZATION_SETTINGS_UPDATED', entityType: 'Organization', entityId: organizationId, metadata: { fields: Object.keys(input) } });
    return organization;
  }

  static async updateLists(user: UserSession, input: { enabledModules?: string[]; clientTypes?: string[]; leadStatuses?: string[] }) {
    const organizationId = (await requireOrganizationContext(user)).id;
    if (input.enabledModules && input.enabledModules.some((x) => !DEFAULT_MODULES.includes(x))) throw new Error('Unsupported module');
    if (input.clientTypes && input.clientTypes.some((x) => !/^[A-Z][A-Z0-9_]{1,31}$/.test(x))) throw new Error('Invalid client type');
    if (input.leadStatuses && input.leadStatuses.some((x) => !/^[A-Z][A-Z0-9_]{1,31}$/.test(x))) throw new Error('Invalid lead status');
    const data = { ...(input.enabledModules ? { enabledModules: JSON.stringify([...new Set(input.enabledModules)]) } : {}), ...(input.clientTypes ? { clientTypes: JSON.stringify([...new Set(input.clientTypes)]) } : {}), ...(input.leadStatuses ? { leadStatuses: JSON.stringify([...new Set(input.leadStatuses)]) } : {}) };
    const settings = await prisma.organizationSettings.upsert({ where: { organizationId }, create: { organizationId, enabledModules: JSON.stringify(input.enabledModules || DEFAULT_MODULES), clientTypes: JSON.stringify(input.clientTypes || DEFAULT_CLIENT_TYPES), leadStatuses: JSON.stringify(input.leadStatuses || DEFAULT_LEAD_STATUSES) }, update: data });
    await AuditService.logAudit({ actorId: user.id, organizationId, action: 'ORGANIZATION_CONFIGURATION_UPDATED', entityType: 'OrganizationSettings', entityId: settings.id, metadata: { fields: Object.keys(input) } });
    return settings;
  }
}
