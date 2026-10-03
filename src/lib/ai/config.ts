function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export type AiProviderName = 'gemini' | 'groq';

export interface AiResearchConfig {
  aiProvider: AiProviderName;
  geminiApiKey: string | null;
  geminiModel: string;
  groqApiKey: string | null;
  groqModel: string;
  groqMaxCompletionTokens: number;
  groqBatchSize: number;
  maxSchoolsPerJob: number;
  maxSourceRequestsPerSchool: number;
  maxProviderRequests?: number;
  maxSourceRequests?: number;
  maxRetries?: number;
  maxTokens?: number;
  maxDurationMs?: number;
}

export function getAiResearchConfig(): AiResearchConfig {
  const requestedProvider = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  return {
    aiProvider: requestedProvider === 'groq' ? 'groq' : 'gemini',
    geminiApiKey: process.env.GEMINI_API_KEY || null,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    groqApiKey: process.env.GROQ_API_KEY || null,
    groqModel: process.env.GROQ_MODEL || 'groq/compound-mini',
    // Deliberately conservative: some Groq accounts/tiers cap total tokens
    // PER MINUTE (TPM) well under typical defaults (an 8000 TPM tier has been
    // observed in practice) — requesting a completion budget close to or
    // above that ceiling gets the *request itself* rejected with 413 Request
    // Entity Too Large, before any generation happens. Override via env if
    // your account's tier allows more.
    groqMaxCompletionTokens: parsePositiveInt(process.env.GROQ_MAX_COMPLETION_TOKENS, 4096),
    // A single compound request asking for "too many" schools at once is
    // rejected outright by Groq (413 Request Entity Too Large) on
    // constrained tiers — observed empirically: 7 succeeded, 9 failed.
    // Larger requests are split into sub-batches of this size (see
    // GroqProvider) rather than exposed to callers as a hard cap.
    groqBatchSize: parsePositiveInt(process.env.GROQ_BATCH_SIZE, 5),
    maxSchoolsPerJob: parsePositiveInt(process.env.AI_RESEARCH_MAX_SCHOOLS, 100),
    maxSourceRequestsPerSchool: parsePositiveInt(process.env.AI_RESEARCH_MAX_SOURCE_REQUESTS_PER_SCHOOL, 3),
    maxProviderRequests: parsePositiveInt(process.env.AI_RESEARCH_MAX_PROVIDER_REQUESTS, 24),
    maxSourceRequests: parsePositiveInt(process.env.AI_RESEARCH_MAX_SOURCE_REQUESTS, 60),
    maxRetries: parsePositiveInt(process.env.AI_RESEARCH_MAX_RETRIES, 8),
    maxTokens: parsePositiveInt(process.env.AI_RESEARCH_MAX_TOKENS, 100_000),
    maxDurationMs: parsePositiveInt(process.env.AI_RESEARCH_MAX_DURATION_MS, 15 * 60 * 1000),
  };
}
