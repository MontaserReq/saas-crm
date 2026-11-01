import prisma from '@/lib/db/prisma';
import { decryptSecret } from '@/lib/integrations/oauth';

export const AI_RESEARCH_STATUSES = ['OFF', 'BETA', 'ON'] as const;
export type AiResearchStatus = typeof AI_RESEARCH_STATUSES[number];

/** Built-in adapters plus the generic OpenAI-compatible adapter. */
export const AI_RESEARCH_PROVIDER_KINDS = ['gemini', 'groq', 'openai-compatible'] as const;
export type AiResearchProvider = typeof AI_RESEARCH_PROVIDER_KINDS[number];

export type AiResearchProviderConfig = {
  id: string;
  name: string;
  kind: AiResearchProvider;
  baseUrl: string;
  model: string;
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
export async function getAiResearchPlatformSettings(): Promise<AiResearchPlatformSettings> {
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
  const providers = parseStoredProviders(values.get(AI_RESEARCH_PROVIDERS_SETTING_KEY)) || legacyProviders(values);
  const requestedActiveId = values.get(AI_RESEARCH_ACTIVE_PROVIDER_SETTING_KEY)
    || (configuredProvider === 'groq' ? 'groq' : configuredProvider === 'gemini' ? 'gemini' : providers[0]?.id || null);
  const activeProvider = providers.find((provider) => provider.id === requestedActiveId) || null;

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
  };
}

export async function getAiResearchFeatureStatus(): Promise<AiResearchStatus> {
  return (await getAiResearchPlatformSettings()).status;
}

export function isAiResearchEnabled(status: AiResearchStatus): boolean {
  return status !== 'OFF';
}
