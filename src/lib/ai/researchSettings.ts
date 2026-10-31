import prisma from '@/lib/db/prisma';
import { decryptSecret } from '@/lib/integrations/oauth';

export const AI_RESEARCH_STATUSES = ['OFF', 'BETA', 'ON'] as const;
export type AiResearchStatus = typeof AI_RESEARCH_STATUSES[number];
export type AiResearchProvider = 'gemini' | 'groq';

export const AI_RESEARCH_SETTING_KEYS = [
  'ai_research_status',
  'ai_research_provider',
  'ai_research_gemini_api_key',
  'ai_research_groq_api_key',
  'ai_research_gemini_model',
  'ai_research_groq_model',
] as const;

export const AI_RESEARCH_CLEARED_SECRET = '__AI_RESEARCH_SECRET_CLEARED__';

export type AiResearchPlatformSettings = {
  status: AiResearchStatus;
  provider: AiResearchProvider;
  geminiApiKey: string | null;
  groqApiKey: string | null;
  geminiModel: string;
  groqModel: string;
};

function validStatus(value: string | undefined): value is AiResearchStatus {
  return AI_RESEARCH_STATUSES.includes(value as AiResearchStatus);
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

  return {
    status: validStatus(configuredStatus) ? configuredStatus : fallbackStatus,
    provider: configuredProvider === 'groq' ? 'groq' : 'gemini',
    geminiApiKey: readSecret(values.get('ai_research_gemini_api_key'), process.env.GEMINI_API_KEY),
    groqApiKey: readSecret(values.get('ai_research_groq_api_key'), process.env.GROQ_API_KEY),
    geminiModel: values.get('ai_research_gemini_model') || process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    groqModel: values.get('ai_research_groq_model') || process.env.GROQ_MODEL || 'groq/compound-mini',
  };
}

export async function getAiResearchFeatureStatus(): Promise<AiResearchStatus> {
  return (await getAiResearchPlatformSettings()).status;
}

export function isAiResearchEnabled(status: AiResearchStatus): boolean {
  return status !== 'OFF';
}
