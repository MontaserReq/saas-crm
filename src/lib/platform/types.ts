export const platformResources = ['organizations', 'users', 'plans', 'subscriptions', 'integrations', 'support', 'settings'] as const;
export type PlatformResource = typeof platformResources[number];
export const platformSections = ['organizations', 'signups', 'billing', 'users', 'integrations', 'health', 'support', 'analytics', 'settings'] as const;
export type PlatformSection = typeof platformSections[number];
export type PlatformRecord = { id: string; [key: string]: string | number | boolean | null };
export type PlatformOption = { id: string; name: string; organizationId?: string };
export type PlatformStats = { organizations: number; activeOrganizations: number; users: number; activeUsers: number; integrations: number; auditEvents: number; openTickets: number; supportCases: number; activeSubscriptions: number; newOrganizations: number };
export type PlatformSectionData = {
  records: PlatformRecord[]; total: number; page: number; pageSize: number; search: string; resource: PlatformResource;
  options: { organizations: PlatformOption[]; roles: PlatformOption[]; departments: PlatformOption[]; plans: PlatformOption[] };
  stats: PlatformStats;
  health: { databaseMs: number; googleConfigured: boolean; microsoftConfigured: boolean } | null;
  defaults: Record<string, string>;
};
