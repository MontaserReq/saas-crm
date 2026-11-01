import prisma from '@/lib/db/prisma';
import type { UserSession } from '@/types';
import { requireOrganizationContext } from '@/lib/auth/organization';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { encryptSecret } from '@/lib/integrations/oauth';
import { organizationAiProviderInput } from '@/lib/platform/validation';
import { AI_RESEARCH_CLEARED_SECRET, AI_PROVIDER_CAPABILITIES } from '@/lib/ai/researchSettings';
import { UniversalAiGateway } from '@/lib/ai/gateway';
import { AuditService } from './AuditService';

function guard(user: UserSession, permission: string) {
  if (!hasPermission(user, permission)) throw new Error('Forbidden');
}

function parseJsonObject(raw: string, label: string): Record<string, string> | null {
  if (!raw) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error(`${label} must be valid JSON`); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${label} must be a JSON object`);
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length > 30 || entries.some(([key, value]) => !/^[A-Za-z0-9-]+$/.test(key) || typeof value !== 'string' || value.length > 1000)) throw new Error(`${label} contains invalid headers`);
  return Object.fromEntries(entries) as Record<string, string>;
}

function parseArray(raw: string, fallback: string[] = []) {
  try { const parsed = JSON.parse(raw || '[]'); return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : fallback; } catch { return fallback; }
}

export class OrganizationAiProviderService {
  static async list(user: UserSession) {
    guard(user, PERMISSIONS.ORGANIZATION_SETTINGS_VIEW);
    const organizationId = (await requireOrganizationContext(user)).id;
    const rows = await prisma.organizationAiProvider.findMany({ where: { organizationId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] });
    return rows.map((row) => ({ id: row.id, name: row.name, kind: row.kind, baseUrl: row.baseUrl, model: row.model, organizationRef: row.organizationRef || '', timeoutMs: row.timeoutMs, maxOutputTokens: row.maxOutputTokens, temperature: row.temperature, capabilities: parseArray(row.capabilities).filter((value) => AI_PROVIDER_CAPABILITIES.includes(value as typeof AI_PROVIDER_CAPABILITIES[number])), featureKeys: parseArray(row.featureKeys), customHeaderNames: row.customHeadersEncrypted && row.customHeadersEncrypted !== AI_RESEARCH_CLEARED_SECRET ? ['configured'] : [], configured: row.apiKeyEncrypted !== AI_RESEARCH_CLEARED_SECRET, enabled: row.enabled, isDefault: row.isDefault }));
  }

  static async save(user: UserSession, raw: unknown) {
    guard(user, PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE);
    const organizationId = (await requireOrganizationContext(user)).id;
    const input = organizationAiProviderInput.parse(raw);
    const existing = input.id ? await prisma.organizationAiProvider.findFirst({ where: { id: input.id, organizationId } }) : null;
    if (input.id && !existing) throw new Error('Organization AI provider not found');
    const existingApiKeyEncrypted = existing?.apiKeyEncrypted && existing.apiKeyEncrypted !== AI_RESEARCH_CLEARED_SECRET ? existing.apiKeyEncrypted : null;
    const apiKey = input.clearApiKey ? null : input.apiKey || existingApiKeyEncrypted;
    if (!apiKey) throw new Error(existing ? 'Keep the current API key or enter a replacement.' : 'API key is required for a new provider.');
    const headers = input.clearCustomHeaders ? null : input.customHeadersJson ? parseJsonObject(input.customHeadersJson, 'Custom headers') : existing?.customHeadersEncrypted && existing.customHeadersEncrypted !== AI_RESEARCH_CLEARED_SECRET ? existing.customHeadersEncrypted : null;
    const data = { organizationId, name: input.name, kind: input.kind, baseUrl: input.baseUrl, model: input.model, organizationRef: input.organizationRef || null, timeoutMs: input.timeoutMs, maxOutputTokens: input.maxOutputTokens, temperature: input.temperature, capabilities: JSON.stringify(input.capabilities), featureKeys: JSON.stringify(input.featureKeys), enabled: input.enabled, isDefault: input.isDefault, apiKeyEncrypted: input.apiKey ? encryptSecret(input.apiKey) : existingApiKeyEncrypted || AI_RESEARCH_CLEARED_SECRET, customHeadersEncrypted: headers ? (typeof headers === 'string' ? headers : encryptSecret(JSON.stringify(headers))) : AI_RESEARCH_CLEARED_SECRET };
    if (data.apiKeyEncrypted === AI_RESEARCH_CLEARED_SECRET) throw new Error('A usable API key is required.');
    const row = await prisma.$transaction(async (tx) => {
      if (input.isDefault) await tx.organizationAiProvider.updateMany({ where: { organizationId, ...(input.id ? { id: { not: input.id } } : {}) }, data: { isDefault: false } });
      return existing ? tx.organizationAiProvider.update({ where: { id: existing.id }, data }) : tx.organizationAiProvider.create({ data });
    });
    await AuditService.logAudit({ actorId: user.id, organizationId, action: existing ? 'ORGANIZATION_AI_PROVIDER_UPDATED' : 'ORGANIZATION_AI_PROVIDER_CREATED', entityType: 'OrganizationAiProvider', entityId: row.id, metadata: { name: row.name, kind: row.kind, enabled: row.enabled, isDefault: row.isDefault, featureKeys: input.featureKeys } });
    return this.list(user);
  }

  static async remove(user: UserSession, id: string) {
    guard(user, PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE);
    const organizationId = (await requireOrganizationContext(user)).id;
    const result = await prisma.organizationAiProvider.deleteMany({ where: { id, organizationId } });
    if (!result.count) throw new Error('Organization AI provider not found');
    await AuditService.logAudit({ actorId: user.id, organizationId, action: 'ORGANIZATION_AI_PROVIDER_DELETED', entityType: 'OrganizationAiProvider', entityId: id });
  }

  static async test(user: UserSession, id: string) {
    guard(user, PERMISSIONS.ORGANIZATION_SETTINGS_VIEW);
    const organizationId = (await requireOrganizationContext(user)).id;
    const provider = await prisma.organizationAiProvider.findFirst({ where: { id, organizationId } });
    if (!provider) throw new Error('Organization AI provider not found');
    if (!provider.enabled) throw new Error('Enable the provider before testing it.');
    const result = await UniversalAiGateway.generate({ providerId: id, purpose: 'organization-provider-connection-test', organizationId, userId: user.id, maxOutputTokens: 20, messages: [{ role: 'user', content: 'Reply with exactly READY.' }] });
    return { providerId: result.providerId, model: result.model, durationMs: result.durationMs };
  }
}
