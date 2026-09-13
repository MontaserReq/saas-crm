import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { GroqProvider } from '@/lib/ai/GroqProvider';
import { GeminiProvider } from '@/lib/ai/GeminiProvider';
import { FallbackAiProvider, createFallbackProvider } from '@/lib/ai/FallbackAiProvider';
import { getAiProvider } from '@/lib/ai';
import { ResearchUsage, sanitizeErrorMessage } from '@/lib/ai/usage';
import { SchoolResearchService } from '@/server/services/SchoolResearchService';
import prisma from '@/lib/db/prisma';

function makeGroqPayload({
  content = JSON.stringify({ schools: [{ name: 'Amman Academy', city: 'Amman', evidence: [{ field: 'name', source: 'Official Website', sourceUrl: 'https://amman.edu' }] }] }),
  executedTools = [{ type: 'search', arguments: { query: 'schools in Amman' } }],
  promptTokens = 1250,
  completionTokens = 380,
  totalTokens = 1630,
}: {
  content?: string;
  executedTools?: any[];
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
} = {}) {
  const usage = promptTokens !== null ? {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
  } : undefined;

  return {
    choices: [{ message: { content, executed_tools: executedTools }, finish_reason: 'stop' }],
    usage,
  };
}

function makeGeminiPayload({
  content = JSON.stringify({ schools: [{ name: 'International School', city: 'Amman', evidence: [{ field: 'name', source: 'Official Website', sourceUrl: 'https://intl.edu' }] }] }),
  webSearchQueries = ['schools in Amman Jordan', 'Amman international academy'],
  promptTokenCount = 1420,
  candidatesTokenCount = 450,
  totalTokenCount = 1870,
}: {
  content?: string;
  webSearchQueries?: string[];
  promptTokenCount?: number | null;
  candidatesTokenCount?: number | null;
  totalTokenCount?: number | null;
} = {}) {
  return {
    candidates: [
      {
        content: {
          parts: [{ text: content }],
        },
        groundingMetadata: {
          webSearchQueries,
        },
      },
    ],
    usageMetadata: promptTokenCount !== null ? {
      promptTokenCount,
      candidatesTokenCount,
      totalTokenCount,
    } : undefined,
  };
}

describe('AI School Research: Usage Tracking & Observability', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const groqConfig = {
    aiProvider: 'groq' as const,
    geminiApiKey: 'test-gemini-key',
    geminiModel: 'gemini-2.0-flash',
    groqApiKey: 'test-groq-key',
    groqModel: 'groq/compound-mini',
    groqMaxCompletionTokens: 4096,
    groqBatchSize: 100,
    maxSchoolsPerJob: 100,
    maxSourceRequestsPerSchool: 3,
  };

  const geminiConfig = {
    ...groqConfig,
    aiProvider: 'gemini' as const,
  };

  describe('1. Groq Usage Capture', () => {
    it('captures exact token usage from payload.usage on success', async () => {
      const payload = makeGroqPayload({ promptTokens: 1500, completionTokens: 400, totalTokens: 1900 });
      (global as any).fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => payload,
        text: async () => JSON.stringify(payload),
      });

      const attempts: ResearchUsage[] = [];
      const onAttempt = (u: ResearchUsage) => attempts.push(u);

      const provider = new GroqProvider(groqConfig, undefined, onAttempt);
      await provider.extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] });

      expect(attempts).toHaveLength(1);
      const [att] = attempts;
      expect(att.provider).toBe('groq');
      expect(att.model).toBe('groq/compound-mini');
      expect(att.status).toBe('SUCCESS');
      expect(att.httpStatus).toBe(200);
      expect(att.inputTokens).toBe(1500);
      expect(att.outputTokens).toBe(400);
      expect(att.totalTokens).toBe(1900);
      expect(att.durationMs).toBeGreaterThanOrEqual(0);
      expect(att.retry).toBe(false);
      expect(att.fallback).toBe(false);
      expect(att.errorCode).toBeNull();
      expect(att.errorMessage).toBeNull();
    });

    it('distinguishes API requests from web searches: counts multiple search tool executions correctly', async () => {
      const payload = makeGroqPayload({
        executedTools: [
          { type: 'search', arguments: { query: 'query 1' } },
          { type: 'search', arguments: { query: 'query 2' } },
          { type: 'search', arguments: { query: 'query 3' } },
          { type: 'code_interpreter', arguments: {} }, // not a search tool
        ],
      });

      (global as any).fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => payload,
        text: async () => JSON.stringify(payload),
      });

      const attempts: ResearchUsage[] = [];
      const provider = new GroqProvider(groqConfig, undefined, (u) => attempts.push(u));
      await provider.extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] });

      expect(attempts).toHaveLength(1);
      // 1 API request executed 3 searches (webSearches != 1)
      expect(attempts[0].webSearches).toBe(3);
      expect(attempts[0].executedTools).toHaveLength(4);
    });

    it('stores null for tokens if provider omits usage (never fabricates token counts)', async () => {
      const payload = makeGroqPayload({ promptTokens: null });
      (global as any).fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => payload,
        text: async () => JSON.stringify(payload),
      });

      const attempts: ResearchUsage[] = [];
      const provider = new GroqProvider(groqConfig, undefined, (u) => attempts.push(u));
      await provider.extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] });

      expect(attempts).toHaveLength(1);
      expect(attempts[0].inputTokens).toBeNull();
      expect(attempts[0].outputTokens).toBeNull();
      expect(attempts[0].totalTokens).toBeNull();
    });

    it('captures 429 RATE_LIMITED attempts with httpStatus 429', async () => {
      const fetchSpy = vi.fn();
      const sleepSpy = vi.fn().mockResolvedValue(undefined);

      // Attempt 1: 429, Attempt 2: 429, Attempt 3: 429 -> exhausted
      for (let i = 0; i < 3; i++) {
        fetchSpy.mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: { get: () => null },
          text: async () => JSON.stringify({ error: { message: 'Rate limit exceeded. Please try again in 2s.' } }),
        });
      }
      (global as any).fetch = fetchSpy;

      const attempts: ResearchUsage[] = [];
      const provider = new GroqProvider(groqConfig, sleepSpy, (u) => attempts.push(u));

      await expect(provider.extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] })).rejects.toThrow();

      expect(attempts).toHaveLength(3);
      expect(attempts[0].status).toBe('RATE_LIMITED');
      expect(attempts[0].httpStatus).toBe(429);
      expect(attempts[0].retry).toBe(false);

      expect(attempts[1].status).toBe('RATE_LIMITED');
      expect(attempts[1].httpStatus).toBe(429);
      expect(attempts[1].retry).toBe(true);

      expect(attempts[2].status).toBe('RATE_LIMITED');
      expect(attempts[2].httpStatus).toBe(429);
      expect(attempts[2].retry).toBe(true);
    });

    it('captures 500 / other HTTP errors as FAILED', async () => {
      (global as any).fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const attempts: ResearchUsage[] = [];
      const provider = new GroqProvider(groqConfig, undefined, (u) => attempts.push(u));

      await expect(provider.extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] })).rejects.toThrow();

      expect(attempts).toHaveLength(1);
      expect(attempts[0].status).toBe('FAILED');
      expect(attempts[0].httpStatus).toBe(500);
      expect(attempts[0].errorCode).toBe('HTTP_500');
    });
  });

  describe('2. Gemini Usage Capture', () => {
    it('captures exact token usage from Gemini usageMetadata', async () => {
      const payload = makeGeminiPayload({ promptTokenCount: 1600, candidatesTokenCount: 520, totalTokenCount: 2120 });
      (global as any).fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => payload,
        text: async () => JSON.stringify(payload),
      });

      const attempts: ResearchUsage[] = [];
      const provider = new GeminiProvider(geminiConfig, (u) => attempts.push(u), false);
      await provider.extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] });

      expect(attempts).toHaveLength(1);
      const [att] = attempts;
      expect(att.provider).toBe('gemini');
      expect(att.status).toBe('SUCCESS');
      expect(att.inputTokens).toBe(1600);
      expect(att.outputTokens).toBe(520);
      expect(att.totalTokens).toBe(2120);
      expect(att.webSearches).toBe(2);
      expect(att.fallback).toBe(false);
    });

    it('captures Gemini error and status correctly', async () => {
      (global as any).fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable',
      });

      const attempts: ResearchUsage[] = [];
      const provider = new GeminiProvider(geminiConfig, (u) => attempts.push(u), false);

      await expect(provider.extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] })).rejects.toThrow();

      expect(attempts).toHaveLength(1);
      expect(attempts[0].status).toBe('FAILED');
      expect(attempts[0].httpStatus).toBe(503);
      expect(attempts[0].errorCode).toBe('HTTP_503');
    });
  });

  describe('3. Retry Tracking', () => {
    it('preserves first attempt and second attempt separately across a 429 retry', async () => {
      const sleepSpy = vi.fn().mockResolvedValue(undefined);
      const successPayload = makeGroqPayload({ promptTokens: 1100, completionTokens: 350, totalTokens: 1450 });

      const fetchSpy = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: { get: () => '1' },
          text: async () => 'Rate limit',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => successPayload,
          text: async () => JSON.stringify(successPayload),
        });

      (global as any).fetch = fetchSpy;

      const attempts: ResearchUsage[] = [];
      const provider = new GroqProvider(groqConfig, sleepSpy, (u) => attempts.push(u));
      const result = await provider.extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] });

      expect(result.schools).toHaveLength(1);
      expect(attempts).toHaveLength(2);

      // Attempt 1: 429 (retry: false)
      expect(attempts[0].attemptNumber).toBe(1);
      expect(attempts[0].status).toBe('RATE_LIMITED');
      expect(attempts[0].httpStatus).toBe(429);
      expect(attempts[0].retry).toBe(false);

      // Attempt 2: SUCCESS (retry: true)
      expect(attempts[1].attemptNumber).toBe(2);
      expect(attempts[1].status).toBe('SUCCESS');
      expect(attempts[1].httpStatus).toBe(200);
      expect(attempts[1].retry).toBe(true);
      expect(attempts[1].totalTokens).toBe(1450);
    });
  });

  describe('4. Fallback Tracking', () => {
    it('records Groq failure (attempt 1) and Gemini success (attempt 2) with fallback=true', async () => {
      const geminiSuccessPayload = makeGeminiPayload({ promptTokenCount: 1300, candidatesTokenCount: 400, totalTokenCount: 1700 });

      const fetchSpy = vi.fn()
        // Groq fails with 400
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () => 'Bad Request',
        })
        // Gemini fallback succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => geminiSuccessPayload,
          text: async () => JSON.stringify(geminiSuccessPayload),
        });

      (global as any).fetch = fetchSpy;

      const attempts: ResearchUsage[] = [];
      const onAttempt = (u: ResearchUsage) => attempts.push(u);

      const groq = new GroqProvider(groqConfig, undefined, onAttempt);
      const fallbackProvider = createFallbackProvider(groq, groqConfig, onAttempt);

      const result = await fallbackProvider.extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] });

      expect(result.schools).toHaveLength(1);
      expect(attempts).toHaveLength(2);

      // Attempt 1: Groq Failed
      expect(attempts[0].provider).toBe('groq');
      expect(attempts[0].status).toBe('FAILED');
      expect(attempts[0].httpStatus).toBe(400);
      expect(attempts[0].fallback).toBe(false);

      // Attempt 2: Gemini Fallback Success
      expect(attempts[1].provider).toBe('gemini');
      expect(attempts[1].status).toBe('SUCCESS');
      expect(attempts[1].httpStatus).toBe(200);
      expect(attempts[1].fallback).toBe(true);
      expect(attempts[1].totalTokens).toBe(1700);
    });
  });

  describe('5. Job-Level Aggregation', () => {
    it('computes accurate totals, averages, retries, and fallbacks', async () => {
      // Mock prisma.schoolResearchAttempt.findMany
      const mockAttempts = [
        {
          provider: 'groq',
          status: 'RATE_LIMITED',
          httpStatus: 429,
          durationMs: 800,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          webSearches: 0,
          isRetry: false,
          isFallback: false,
        },
        {
          provider: 'groq',
          status: 'SUCCESS',
          httpStatus: 200,
          durationMs: 2500,
          inputTokens: 1200,
          outputTokens: 300,
          totalTokens: 1500,
          webSearches: 2,
          isRetry: true,
          isFallback: false,
        },
        {
          provider: 'gemini',
          status: 'SUCCESS',
          httpStatus: 200,
          durationMs: 3200,
          inputTokens: 1800,
          outputTokens: 400,
          totalTokens: 2200,
          webSearches: 3,
          isRetry: false,
          isFallback: true,
        },
      ];

      vi.spyOn(prisma.schoolResearchAttempt, 'findMany').mockResolvedValueOnce(mockAttempts as any);

      const summary = await SchoolResearchService.getJobUsageSummary('test-job-id');

      expect(summary).not.toBeNull();
      expect(summary?.totalApiRequests).toBe(3);
      expect(summary?.totalWebSearches).toBe(5); // 0 + 2 + 3
      expect(summary?.groqRequests).toBe(2);
      expect(summary?.geminiRequests).toBe(1);
      expect(summary?.retryCount).toBe(1);
      expect(summary?.fallbackCount).toBe(1);
      expect(summary?.inputTokens).toBe(3000); // 1200 + 1800
      expect(summary?.outputTokens).toBe(700);  // 300 + 400
      expect(summary?.totalTokens).toBe(3700);  // 1500 + 2200
      expect(summary?.rateLimitErrors).toBe(1);
      expect(summary?.otherErrors).toBe(0);
      expect(summary?.avgDurationMs).toBe(Math.round((800 + 2500 + 3200) / 3));
      expect(summary?.minDurationMs).toBe(800);
      expect(summary?.maxDurationMs).toBe(3200);
    });
  });

  describe('6. Security & Sensitive Data Redaction', () => {
    it('sanitizes Authorization headers and API keys from error messages', () => {
      const rawError = 'Request failed with Bearer gsk_secret123456789 and api_key=AIzaSySecretApiKeyInLog';
      const sanitized = sanitizeErrorMessage(rawError);

      expect(sanitized).not.toContain('gsk_secret123456789');
      expect(sanitized).not.toContain('AIzaSySecretApiKeyInLog');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('ensures provider requests never pass API keys in usage records', async () => {
      (global as any).fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized: Invalid Bearer secret-groq-key-999',
      });

      const attempts: ResearchUsage[] = [];
      const provider = new GroqProvider(groqConfig, undefined, (u) => attempts.push(u));

      await expect(provider.extractSchools({ location: 'Amman', requestedCount: 5, requiredFields: ['phone'] })).rejects.toThrow();

      expect(attempts).toHaveLength(1);
      expect(attempts[0].errorMessage).not.toContain('secret-groq-key-999');
      expect(attempts[0].errorMessage).toContain('[REDACTED]');
    });
  });
});
