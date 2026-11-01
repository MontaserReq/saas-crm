import prisma from '@/lib/db/prisma';
import { decryptSecret } from '@/lib/integrations/oauth';
import { getOrganizationAiUsagePolicy } from './organizationPolicy';

export const AI_RESEARCH_STATUSES = ['OFF', 'BETA', 'ON'] as const;
export type AiResearchStatus = typeof AI_RESEARCH_STATUSES[number];

/** Built-in adapters plus the generic OpenAI-compatible adapter. */
export const AI_RESEARCH_PROVIDER_KINDS = ['gemini', 'groq', 'openai-compatible', 'openai-responses', 'anthropic', 'custom-http'] as const;
export type AiResearchProvider = typeof AI_RESEARCH_PROVIDER_KINDS[number];
export const AI_PROVIDER_CAPABILITIES = ['text', 'streaming', 'structured-json', 'tools', 'vision', 'embeddings', 'reasoning'] as const;
export type AiProviderCapability = typeof AI_PROVIDER_CAPABILITIES[number];

export type AiResearchProviderConfig = {
  id: string;
  name: string;
  kind: AiResearchProvider;
  baseUrl: string;
  model: string;
  organizationId?: string;
  customHeaders?: Record<string, string>;
  timeoutMs?: number;
  maxOutputTokens?: number;
  temperature?: number;
  responsePath?: string;
  inputCostPerMillionUsd?: number;
  outputCostPerMillionUsd?: number;
  capabilities?: AiProviderCapability[];
  featureKeys?: string[];
  scope?: 'platform' | 'organization';
  metadata?: Record<string, unknown>;
  apiKey: string | null;
  enabled: boolean;
};

export const AI_RESEARCH_PROVIDERS_SETTING_KEY = 'ai_research_providers';
export const AI_RESEARCH_ACTIVE_PROVIDER_SETTING_KEY = 'ai_research_active_provider';
export const AI_RESEARCH_SETTING_KEYS = [
  'ai_research_status',
  'ai_research_provider',
  'ai_research_gemini_api_key',
  'ai_research_groq_api_key',
  'ai_research_gemini_model',
  'ai_research_groq_model',
  AI_RESEARCH_PROVIDERS_SETTING_KEY,
  AI_RESEARCH_ACTIVE_PROVIDER_SETTING_KEY,
  'ai_feature_providers',
  'ai_fallback_providers',
] as const;

export const AI_RESEARCH_CLEARED_SECRET = '__AI_RESEARCH_SECRET_CLEARED__';

export type AiResearchPlatformSettings = {
  status: AiResearchStatus;
  /** Legacy alias retained for existing code and environment compatibility. */
  provider: AiResearchProvider;
  geminiApiKey: string | null;
  groqApiKey: string | null;
  geminiModel: string;
  groqModel: string;
  providers: AiResearchProviderConfig[];
  activeProviderId: string | null;
  activeProvider: AiResearchProviderConfig | null;
  featureProviderIds: Record<string, string>;
  fallbackProviderIds: string[];
};

function validStatus(value: string | undefined): value is AiResearchStatus {
  return AI_RESEARCH_STATUSES.includes(value as AiResearchStatus);
}

function validKind(value: unknown): value is AiResearchProvider {
  return AI_RESEARCH_PROVIDER_KINDS.includes(value as AiResearchProvider);
}

function readSecret(stored: string | undefined, fallback: string | undefined): string | null {
  if (stored === AI_RESEARCH_CLEARED_SECRET) return null;
  if (!stored) return fallback || null;
  try {
    return decryptSecret(stored);
  } catch {
    // Never treat an invalid/corrupt ciphertext as a usable API key.
    return null;
  }
}

function readJsonSecret(stored: string | undefined): Record<string, string> | undefined {
  const value = readSecret(stored, undefined);
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    const entries = Object.entries(parsed).filter(([key, item]) => key.length <= 120 && typeof item === 'string' && item.length <= 1000);
    return Object.fromEntries(entries) as Record<string, string>;
  } catch { return undefined; }
}

function safeHeaders(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value).filter(([key, item]) => key.length <= 120 && typeof item === 'string' && item.length <= 1000);
  return entries.length ? Object.fromEntries(entries) as Record<string, string> : undefined;
}

function legacyProviders(values: Map<string, string>): AiResearchProviderConfig[] {
  const geminiModel = values.get('ai_research_gemini_model') || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const groqModel = values.get('ai_research_groq_model') || process.env.GROQ_MODEL || 'groq/compound-mini';
  return [
    {
      id: 'gemini',
      name: 'Google Gemini',
      kind: 'gemini',
      baseUrl: '',
      model: geminiModel,
      apiKey: readSecret(values.get('ai_research_gemini_api_key'), process.env.GEMINI_API_KEY),
      enabled: true,
    },
    {
      id: 'groq',
      name: 'Groq',
      kind: 'groq',
      baseUrl: '',
      model: groqModel,
      apiKey: readSecret(values.get('ai_research_groq_api_key'), process.env.GROQ_API_KEY),
      enabled: true,
    },
  ];
}

function parseStoredProviders(raw: string | undefined): AiResearchProviderConfig[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const providers = parsed.flatMap((item: any) => {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string' || typeof item.name !== 'string' || !validKind(item.kind)) return [];
      return [{
        id: item.id,
        name: item.name,
        kind: item.kind,
        baseUrl: typeof item.baseUrl === 'string' ? item.baseUrl : '',
        model: typeof item.model === 'string' ? item.model : '',
        organizationId: typeof item.organizationId === 'string' ? item.organizationId : undefined,
        customHeaders: readJsonSecret(typeof item.customHeadersEncrypted === 'string' ? item.customHeadersEncrypted : undefined) || safeHeaders(item.customHeaders),
        timeoutMs: typeof item.timeoutMs === 'number' ? item.timeoutMs : undefined,
        maxOutputTokens: typeof item.maxOutputTokens === 'number' ? item.maxOutputTokens : undefined,
        temperature: typeof item.temperature === 'number' ? item.temperature : undefined,
        responsePath: typeof item.responsePath === 'string' ? item.responsePath : undefined,
        inputCostPerMillionUsd: typeof item.inputCostPerMillionUsd === 'number' ? item.inputCostPerMillionUsd : undefined,
        outputCostPerMillionUsd: typeof item.outputCostPerMillionUsd === 'number' ? item.outputCostPerMillionUsd : undefined,
        capabilities: Array.isArray(item.capabilities) ? item.capabilities.filter((value: unknown): value is AiProviderCapability => AI_PROVIDER_CAPABILITIES.includes(value as AiProviderCapability)) : undefined,
        metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata : undefined,
        apiKey: readSecret(typeof item.apiKeyEncrypted === 'string' ? item.apiKeyEncrypted : undefined, undefined),
        enabled: item.enabled !== false,
      } satisfies AiResearchProviderConfig];
    });
    return providers;
  } catch {
    return null;
  }
}

/**
 * Reads global AI Research configuration. Environment variables remain a
 * compatibility fallback for existing deployments; Platform Admin settings
 * override them once saved.
 */
export async function getAiResearchPlatformSettings(organizationId?: string): Promise<AiResearchPlatformSettings> {
  const fallbackStatus = process.env.NODE_ENV === 'test' ? 'ON' : 'OFF';
  let rows: Array<{ key: string; value: string }> = [];
  try {
    rows = await prisma.platformSetting.findMany({
      where: { key: { in: [...AI_RESEARCH_SETTING_KEYS] } },
      select: { key: true, value: true },
    });
  } catch {
    // Tests and older installations may not have the settings table/client yet.
    // Production fails closed to OFF; the test fallback preserves existing
    // service-level security tests until the database fixture is upgraded.
  }
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const configuredStatus = values.get('ai_research_status') || process.env.AI_RESEARCH_STATUS;
  const configuredProvider = values.get('ai_research_provider') || process.env.AI_PROVIDER;
  const platformProviders = parseStoredProviders(values.get(AI_RESEARCH_PROVIDERS_SETTING_KEY)) || legacyProviders(values);
  const policy = organizationId ? await getOrganizationAiUsagePolicy(organizationId) : null;
  let organizationRows: Array<{ id: string; name: string; kind: string; baseUrl: string; model: string; apiKeyEncrypted: string; customHeadersEncrypted: string | null; organizationRef: string | null; timeoutMs: number; maxOutputTokens: number; temperature: number; capabilities: string; featureKeys: string; enabled: boolean; isDefault: boolean }> = [];
  if (organizationId && policy?.allowOrganizationProviders !== false) {
    try {
      organizationRows = await prisma.organizationAiProvider.findMany({ where: { organizationId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }], select: { id: true, name: true, kind: true, baseUrl: true, model: true, apiKeyEncrypted: true, customHeadersEncrypted: true, organizationRef: true, timeoutMs: true, maxOutputTokens: true, temperature: true, capabilities: true, featureKeys: true, enabled: true, isDefault: true } });
    } catch { /* Older installations use platform-only resolution until migrated. */ }
  }
  const organizationProviders = organizationRows.flatMap((row) => {
    if (!validKind(row.kind)) return [];
    let capabilities: AiProviderCapability[] = [];
    let featureKeys: string[] = [];
    try { const parsed = JSON.parse(row.capabilities); if (Array.isArray(parsed)) capabilities = parsed.filter((value): value is AiProviderCapability => AI_PROVIDER_CAPABILITIES.includes(value as AiProviderCapability)); } catch { /* empty */ }
    try { const parsed = JSON.parse(row.featureKeys); if (Array.isArray(parsed)) featureKeys = parsed.filter((value): value is string => typeof value === 'string'); } catch { /* empty */ }
    return [{ id: row.id, name: row.name, kind: row.kind, baseUrl: row.baseUrl, model: row.model, organizationId: row.organizationRef || undefined, customHeaders: readJsonSecret(row.customHeadersEncrypted || undefined), timeoutMs: row.timeoutMs, maxOutputTokens: row.maxOutputTokens, temperature: row.temperature, capabilities, featureKeys, scope: 'organization' as const, apiKey: readSecret(row.apiKeyEncrypted, undefined), enabled: row.enabled } satisfies AiResearchProviderConfig];
  });
  const providers = [...organizationProviders, ...(policy?.allowPlatformProviders === false ? [] : platformProviders)];
  const platformRequestedActiveId = values.get(AI_RESEARCH_ACTIVE_PROVIDER_SETTING_KEY)
    || (configuredProvider === 'groq' ? 'groq' : configuredProvider === 'gemini' ? 'gemini' : providers[0]?.id || null);
  const organizationDefault = organizationProviders.find((provider) => provider.enabled && provider.apiKey && organizationRows.find((row) => row.id === provider.id)?.isDefault);
  const requestedActiveId = organizationDefault?.id || platformRequestedActiveId;
  const activeProvider = providers.find((provider) => provider.id === requestedActiveId) || null;
  let featureProviderIds: Record<string, string> = {};
  try {
    const parsed = JSON.parse(values.get('ai_feature_providers') || '{}');
    if (parsed && typeof parsed === 'object') {
      featureProviderIds = Object.entries(parsed).reduce<Record<string, string>>((result, [key, value]) => {
        if (typeof value === 'string') result[key] = value;
        return result;
      }, {});
    }
  } catch { /* use the global default */ }
  let fallbackProviderIds: string[] = [];
  try {
    const parsed = JSON.parse(values.get('ai_fallback_providers') || '[]');
    if (Array.isArray(parsed)) fallbackProviderIds = parsed.filter((value): value is string => typeof value === 'string');
  } catch { /* use no explicit fallbacks */ }
  for (const provider of organizationProviders) for (const feature of provider.featureKeys || []) if (provider.enabled && provider.apiKey) featureProviderIds[feature] = provider.id;

  return {
    status: validStatus(configuredStatus) ? configuredStatus : fallbackStatus,
    provider: activeProvider?.kind || (configuredProvider === 'groq' ? 'groq' : 'gemini'),
    geminiApiKey: providers.find((provider) => provider.kind === 'gemini')?.apiKey || null,
    groqApiKey: providers.find((provider) => provider.kind === 'groq')?.apiKey || null,
    geminiModel: providers.find((provider) => provider.kind === 'gemini')?.model || process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    groqModel: providers.find((provider) => provider.kind === 'groq')?.model || process.env.GROQ_MODEL || 'groq/compound-mini',
    providers,
    activeProviderId: activeProvider?.id || null,
    activeProvider,
    featureProviderIds,
    fallbackProviderIds,
  };
}

export async function getAiResearchFeatureStatus(): Promise<AiResearchStatus> {
  return (await getAiResearchPlatformSettings()).status;
}

export function isAiResearchEnabled(status: AiResearchStatus): boolean {
  return status !== 'OFF';
}
