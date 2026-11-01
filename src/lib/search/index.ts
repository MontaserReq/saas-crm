import crypto from 'node:crypto';
import prisma from '@/lib/db/prisma';
import { fetchPublicContent } from './http';
import { getSearchProviderSettings } from './settings';
import type { SearchProviderConfig } from './settings';
import { createSearchProvider } from './providers';
import type { SearchRequest, SearchResult } from './types';
import { safeProviderEndpoint } from '@/lib/security/url';
import { safeExternalUrl } from '@/lib/security/url';

export * from './types';
export * from './settings';

const CACHE_TTL_MS = 15 * 60 * 1000;
const CONTENT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function queryHash(request: SearchRequest): string {
  return crypto.createHash('sha256').update(JSON.stringify({ query: request.query.trim().toLowerCase(), maxResults: request.maxResults || 25, includeContent: request.includeContent !== false })).digest('hex');
}

function cacheKey(providerId: string, request: SearchRequest): string {
  return `${providerId}:${queryHash(request)}`;
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : 'Search provider request failed';
}

async function recordSearchUsage(request: SearchRequest, providerId: string, data: { status: string; resultCount?: number; durationMs: number; estimatedCostUsd?: number | null; errorMessage?: string; httpStatus?: number }) {
  try {
    await prisma.searchProviderUsageLog.create({ data: { organizationId: request.organizationId || null, userId: request.userId || null, providerId, purpose: request.purpose || null, queryHash: queryHash(request), status: data.status, resultCount: data.resultCount || 0, durationMs: data.durationMs, estimatedCostUsd: data.estimatedCostUsd ?? null, httpStatus: data.httpStatus || null, errorMessage: data.errorMessage || null } });
  } catch {
    // Search telemetry must never break a customer-facing search.
  }
}

async function readCachedResults(providerId: string, request: SearchRequest): Promise<SearchResult[] | null> {
  try {
    const cached = await prisma.searchResultCache.findUnique({ where: { cacheKey: cacheKey(providerId, request) } });
    if (!cached) return null;
    if (cached.expiresAt <= new Date()) {
      void prisma.searchResultCache.delete({ where: { id: cached.id } }).catch(() => undefined);
      return null;
    }
    const parsed = JSON.parse(cached.payload) as unknown;
    return Array.isArray(parsed) ? parsed as SearchResult[] : null;
  } catch {
    return null;
  }
}

async function writeCachedResults(providerId: string, request: SearchRequest, results: SearchResult[]) {
  try {
    await prisma.searchResultCache.upsert({ where: { cacheKey: cacheKey(providerId, request) }, create: { cacheKey: cacheKey(providerId, request), providerId, query: request.query.trim().slice(0, 1000), payload: JSON.stringify(results), expiresAt: new Date(Date.now() + CACHE_TTL_MS) }, update: { providerId, query: request.query.trim().slice(0, 1000), payload: JSON.stringify(results), expiresAt: new Date(Date.now() + CACHE_TTL_MS) } });
  } catch {
    // A cache failure must not fail the search.
  }
}

async function readCachedContent(url: string): Promise<{ url: string; content: string } | null> {
  try {
    const cached = await prisma.searchContentCache.findUnique({ where: { url } });
    if (!cached) return null;
    if (cached.expiresAt <= new Date()) {
      void prisma.searchContentCache.delete({ where: { id: cached.id } }).catch(() => undefined);
      return null;
    }
    return { url: cached.url, content: cached.content };
  } catch {
    return null;
  }
}

async function writeCachedContent(content: { url: string; content: string }) {
  try {
    await prisma.searchContentCache.upsert({
      where: { url: content.url },
      create: { url: content.url, content: content.content, expiresAt: new Date(Date.now() + CONTENT_CACHE_TTL_MS) },
      update: { content: content.content, expiresAt: new Date(Date.now() + CONTENT_CACHE_TTL_MS) },
    });
  } catch {
    // A content-cache failure must not fail enrichment.
  }
}

function retryableSearchError(error: unknown): boolean {
  if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) return true;
  return error instanceof Error && /HTTP (408|409|425|429|5\d\d)\b/.test(error.message);
}

async function searchWithRetry(provider: SearchProviderConfig, request: SearchRequest) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await createSearchProvider(provider).search(request); } catch (error) {
      lastError = error;
      if (attempt === 1 || !retryableSearchError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Search provider request failed');
}

export class SearchGateway {
  static async search(request: SearchRequest): Promise<{ providerId: string; results: SearchResult[] }> {
    const settings = await getSearchProviderSettings();
    const candidates = settings.providers.filter((provider) => provider.enabled && provider.apiKey && safeProviderEndpoint(provider.baseUrl));
    const preferred = candidates.find((provider) => provider.id === settings.activeProviderId);
    const explicitFallbacks = settings.fallbackProviderIds.map((id) => candidates.find((provider) => provider.id === id)).filter((provider): provider is NonNullable<typeof provider> => Boolean(provider && provider.id !== preferred?.id));
    const ordered = [preferred, ...explicitFallbacks, ...candidates.filter((provider) => provider.id !== preferred?.id && !explicitFallbacks.some((fallback) => fallback.id === provider.id))].filter((provider): provider is NonNullable<typeof provider> => Boolean(provider));
    if (!ordered.length) throw new Error('No enabled search provider with an API key is configured.');
    let lastError: unknown;
    for (const config of ordered) {
      const startedAt = performance.now();
      const cached = await readCachedResults(config.id, request);
      if (cached) {
        await recordSearchUsage(request, config.id, { status: 'CACHED', resultCount: cached.length, estimatedCostUsd: 0, durationMs: Math.round(performance.now() - startedAt) });
        return { providerId: config.id, results: cached };
      }
      try {
        const results = await searchWithRetry(config, request);
        await writeCachedResults(config.id, request, results);
        await recordSearchUsage(request, config.id, { status: 'SUCCESS', resultCount: results.length, estimatedCostUsd: config.estimatedCostPerRequestUsd, durationMs: Math.round(performance.now() - startedAt) });
        return { providerId: config.id, results };
      } catch (error) {
        lastError = error;
        await recordSearchUsage(request, config.id, { status: 'FAILED', durationMs: Math.round(performance.now() - startedAt), errorMessage: safeError(error) });
      }
    }
    throw lastError instanceof Error ? lastError : new Error('All configured search providers failed.');
  }

  static async fetchContent(url: string, maxBytes?: number) {
    const normalized = safeExternalUrl(url);
    if (!normalized) throw new Error('Only valid public http(s) URLs can be enriched.');
    const cached = await readCachedContent(normalized);
    if (cached) return cached;
    const content = await fetchPublicContent(normalized, maxBytes);
    await writeCachedContent(content);
    return content;
  }

  static async getSearchMetadata(organizationId?: string) {
    const settings = await getSearchProviderSettings();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    try {
      const usage = await prisma.searchProviderUsageLog.groupBy({ by: ['providerId', 'status'], where: { organizationId: organizationId || undefined, createdAt: { gte: since } }, _count: { _all: true }, _sum: { resultCount: true, durationMs: true } });
      return { activeProviderId: settings.activeProviderId, fallbackProviderIds: settings.fallbackProviderIds, providers: settings.providers.map(({ apiKey, ...provider }) => ({ ...provider, configured: Boolean(apiKey) })), usage: usage.map((row) => ({ providerId: row.providerId, status: row.status, requests: row._count._all, resultCount: row._sum.resultCount || 0, durationMs: row._sum.durationMs || 0 })) };
    } catch {
      return { activeProviderId: settings.activeProviderId, fallbackProviderIds: settings.fallbackProviderIds, providers: settings.providers.map(({ apiKey, ...provider }) => ({ ...provider, configured: Boolean(apiKey) })), usage: [] };
    }
  }

  static async testProvider(providerId: string) {
    const settings = await getSearchProviderSettings();
    const provider = settings.providers.find((candidate) => candidate.id === providerId);
    if (!provider || !provider.enabled || !provider.apiKey || !safeProviderEndpoint(provider.baseUrl)) throw new Error('Search provider is not enabled or configured with a public endpoint.');
    const results = await createSearchProvider(provider).search({ query: 'SatrCRM connection test', maxResults: 1, includeContent: false });
    return { providerId, resultCount: results.length };
  }
}
