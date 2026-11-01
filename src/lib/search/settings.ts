import prisma from '@/lib/db/prisma';
import { decryptSecret } from '@/lib/integrations/oauth';
import type { SearchProviderKind } from './types';

export type SearchProviderConfig = {
  id: string;
  name: string;
  kind: SearchProviderKind;
  baseUrl: string;
  apiKey: string | null;
  enabled: boolean;
  maxResults: number;
};

export const SEARCH_PROVIDERS_SETTING_KEY = 'search_providers';
export const SEARCH_ACTIVE_PROVIDER_SETTING_KEY = 'search_active_provider';
export const SEARCH_SETTING_KEYS = [SEARCH_PROVIDERS_SETTING_KEY, SEARCH_ACTIVE_PROVIDER_SETTING_KEY] as const;
const CLEARED_SECRET = '__SEARCH_SECRET_CLEARED__';

function decrypt(value: unknown): string | null {
  if (value === CLEARED_SECRET) return null;
  if (typeof value !== 'string' || !value) return null;
  try { return decryptSecret(value); } catch { return null; }
}

function envProviders(): SearchProviderConfig[] {
  return [
    { id: 'exa', name: 'Exa', kind: 'exa', baseUrl: 'https://api.exa.ai', apiKey: process.env.EXA_API_KEY || null, enabled: true, maxResults: 25 },
    { id: 'brave', name: 'Brave Search', kind: 'brave', baseUrl: 'https://api.search.brave.com/res/v1', apiKey: process.env.BRAVE_SEARCH_API_KEY || null, enabled: true, maxResults: 25 },
  ];
}

export async function getSearchProviderSettings() {
  let rows: Array<{ key: string; value: string }> = [];
  try {
    rows = await prisma.platformSetting.findMany({ where: { key: { in: [...SEARCH_SETTING_KEYS] } }, select: { key: true, value: true } });
  } catch { /* older test databases */ }
  const values = new Map(rows.map((row) => [row.key, row.value]));
  let providers = envProviders();
  const raw = values.get(SEARCH_PROVIDERS_SETTING_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) providers = parsed.flatMap((item: any) => {
        if (!item || typeof item.id !== 'string' || typeof item.name !== 'string' || !['exa', 'brave', 'custom'].includes(item.kind)) return [];
        return [{ id: item.id, name: item.name, kind: item.kind, baseUrl: typeof item.baseUrl === 'string' ? item.baseUrl : '', apiKey: decrypt(item.apiKeyEncrypted), enabled: item.enabled !== false, maxResults: Math.min(100, Math.max(1, Number(item.maxResults) || 25)) } satisfies SearchProviderConfig];
      });
    } catch { /* fall back to environment providers */ }
  }
  const activeProviderId = values.get(SEARCH_ACTIVE_PROVIDER_SETTING_KEY) || providers.find((provider) => provider.enabled && provider.apiKey)?.id || providers[0]?.id || null;
  return { providers, activeProviderId, activeProvider: providers.find((provider) => provider.id === activeProviderId) || null };
}

export function searchClearedSecret(): string { return CLEARED_SECRET; }
