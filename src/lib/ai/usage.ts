/**
 * Normalized usage / observability types for AI School Research.
 *
 * Every provider (Groq, Gemini) maps its own response metadata into
 * ResearchUsage so the rest of the system never has to know which provider
 * was used to read token counts.
 *
 * IMPORTANT: These types are instrumentation-only. They must never affect
 * research logic, prompts, provider selection, or output.
 */

export type ResearchProvider = 'groq' | 'gemini';
export type ResearchAttemptStatus = 'SUCCESS' | 'FAILED' | 'RATE_LIMITED';

/**
 * Per-request usage record emitted by each provider attempt.
 *
 * Distinguishes two orthogonal concepts:
 *   - apiRequest: one HTTP call to the provider (1 Groq call OR 1 Gemini call)
 *   - webSearches: tool executions within that call (1 Groq compound request
 *     may internally execute 3 web searches — these must be counted separately)
 */
export interface ResearchUsage {
  provider: ResearchProvider;
  model: string;

  /** Sequential attempt number within the job (1-based). */
  attemptNumber: number;

  status: ResearchAttemptStatus;

  /** Actual wall-clock duration of the HTTP request, in milliseconds. */
  durationMs: number;

  /** When the HTTP request was initiated. */
  startedAt: Date;
  /** When the HTTP response was fully received. */
  completedAt: Date;

  // --- Token usage (null when the provider did not return them) ---
  // Never estimated. If the provider does not include usage in its response,
  // these are null rather than 0 or a guess.
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;

  /**
   * Number of web / tool searches that actually executed within this API call.
   * For Groq compound: counted from executed_tools filtered to search-type entries.
   * For Gemini: counted from groundingMetadata.webSearchQueries if present.
   * NEVER assumed to equal 1 per API request.
   */
  webSearches: number;

  /**
   * Raw executed_tools array from Groq compound response (for debugging).
   * null for Gemini (uses different grounding metadata format).
   */
  executedTools: unknown[] | null;

  /** true if this attempt was a retry of a previous RATE_LIMITED attempt. */
  retry: boolean;

  /** true if this attempt is a fallback (e.g. Groq failed → this is Gemini). */
  fallback: boolean;

  /** HTTP status code from the provider response, null on network errors. */
  httpStatus: number | null;

  /**
   * Short machine-readable error code (e.g. 'RATE_LIMITED', 'TIMEOUT',
   * 'NETWORK_ERROR', 'PARSE_ERROR'). null on success.
   */
  errorCode: string | null;

  /**
   * Sanitized human-readable error message. Never contains API keys,
   * authorization headers, secrets, or full request payloads.
   * Truncated to 500 characters.
   */
  errorMessage: string | null;
}

/**
 * Callback type installed by the service layer on the provider chain.
 * Providers call this after every individual API request (success or failure).
 * The callback MUST be non-throwing — any error it raises is the caller's
 * responsibility to catch.
 */
export type OnAttemptCallback = (usage: ResearchUsage) => unknown | Promise<unknown>;

/**
 * Job-level aggregation of all ResearchAttempt records.
 * Computed by the service layer, never by the provider.
 */
export interface JobUsageSummary {
  /** Total individual HTTP requests made (Groq + Gemini combined). */
  totalApiRequests: number;

  /** Total web/tool searches executed across all requests. */
  totalWebSearches: number;

  groqRequests: number;
  geminiRequests: number;

  /** Attempts where retry=true (i.e. came after a RATE_LIMITED attempt). */
  retryCount: number;

  /** Attempts where fallback=true (i.e. Groq failed → Gemini took over). */
  fallbackCount: number;

  /** Summed from successful attempts only (null when no successful attempts). */
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;

  /** 429 HTTP errors specifically (rate limit). */
  rateLimitErrors: number;

  /** Any other non-success, non-rate-limit outcome. */
  otherErrors: number;

  /** Average duration in ms across all attempts. */
  avgDurationMs: number | null;
  minDurationMs: number | null;
  maxDurationMs: number | null;
}

/** Sanitizes an error message so it never leaks secrets or keys. */
export function sanitizeErrorMessage(raw: string | undefined | null): string | null {
  if (!raw) return null;
  // Strip anything that looks like a Bearer token or API key value
  const cleaned = raw
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/(api[_-]?key|authorization|x-api-key)\s*[:=]\s*\S+/gi, '$1=[REDACTED]')
    .slice(0, 500);
  return cleaned || null;
}
