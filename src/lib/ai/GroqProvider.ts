import {
  AiExtractionError,
  AiNotConfiguredError,
  AiProvider,
  AiTruncatedResponseError,
  SchoolExtractionInput,
  SchoolExtractionItem,
  SchoolExtractionResult,
} from './types';
import { AiResearchConfig } from './config';
import { buildCompactRetryInstruction, buildExtractionPrompt, parseExtractionResponseText } from './shared';
import { OnAttemptCallback, ResearchUsage, sanitizeErrorMessage } from './usage';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 45_000;

// Truncation gets exactly one bounded retry with a more compact prompt.
// Never retried: HTTP/network failures, missing-web-search, or JSON that is
// simply malformed (not truncated) — those are handed to FallbackAiProvider
// (Groq -> Gemini) immediately instead of spending time retrying Groq. This
// is entirely separate from the 429 rate-limit retry below.
const MAX_ATTEMPTS = 2;

// Bounds the total number of Groq calls a single extractSchools() invocation
// can make when a large requestedCount is split into sub-batches (see
// config.groqBatchSize below). This is a ceiling on *effort*, not on how
// many schools the caller may request.
const MAX_BATCHES = 6;

// 429 (rate limit) handling: a small, fixed number of retries — never
// unbounded — separate from the truncation retry above. Only 429 is
// retried here; any other 4xx/5xx (e.g. 400, 413) fails immediately.
const MAX_RATE_LIMIT_ATTEMPTS = 3; // 1 initial try + up to 2 retries
const RATE_LIMIT_BACKOFF_MS = [2000, 5000]; // used only when Groq gives no retry-timing info, indexed by retry number
const MAX_RATE_LIMIT_WAIT_MS = 60_000; // sanity ceiling even when honoring a server-provided Retry-After

/** Groq's compound models report which built-in tools they actually invoked here. */
function usedWebSearch(message: any): boolean {
  const executedTools = message?.executed_tools;
  if (!Array.isArray(executedTools) || executedTools.length === 0) return false;
  return executedTools.some((tool: any) => typeof tool?.type === 'string' && tool.type.toLowerCase().includes('search'));
}

/** Count the number of search-type tool executions in a compound response. */
function countWebSearches(message: any): number {
  const executedTools = message?.executed_tools;
  if (!Array.isArray(executedTools)) return 0;
  return executedTools.filter((tool: any) => typeof tool?.type === 'string' && tool.type.toLowerCase().includes('search')).length;
}

/**
 * Reads how long to wait before retrying a 429, preferring real
 * server-provided timing over a guess: the standard `Retry-After` header
 * (seconds, or an HTTP date), falling back to the duration Groq's own error
 * message reports (observed as e.g. "Please try again in 46.035s."). Returns
 * null if neither is present/parseable, so the caller can fall back to a
 * fixed backoff schedule.
 */
export function parseRetryAfterMs(response: { headers?: { get?: (name: string) => string | null } }, bodyText: string): number | null {
  const header = response.headers?.get?.('retry-after');
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const dateMs = Date.parse(header);
    if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  }

  const bodyMatch = bodyText.match(/try again in\s+([\d.]+)\s*s/i);
  if (bodyMatch) {
    const seconds = Number(bodyMatch[1]);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  }

  return null;
}

interface GroqCallResult {
  message: any;
  finishReason: string | null;
  // Usage metadata from payload.usage (null when Groq did not return them)
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  isRetry: boolean;
}

/**
 * Groq provider using a "compound" model (e.g. groq/compound-mini), which
 * autonomously decides to call Groq's built-in web search tool. Requests
 * are rejected (AiExtractionError) if the model answered WITHOUT actually
 * searching — a plain, ungrounded LLM guess must never be accepted as a
 * research result.
 *
 * Reliability notes (from live testing against a real, rate-limited Groq
 * account — see the AI School Research provider report for full detail):
 *
 * - `response_format` (json_object / json_schema "Structured Outputs") is
 *   documented as incompatible with tool use and unsupported for
 *   compound/compound-mini — forcing it would break web search outright, so
 *   it is deliberately NOT used.
 * - The completion-token budget (config.groqMaxCompletionTokens) is kept
 *   conservative so a single request's declared budget doesn't itself
 *   exceed a small account's total per-minute token ceiling.
 * - A single compound request asking for too many schools in one go is
 *   rejected outright by Groq with 413 Request Entity Too Large —
 *   independent of max_completion_tokens. Requests above config.groqBatchSize
 *   are therefore split into sequential sub-batches here — fully
 *   transparent to the caller, which still gets the full requested count.
 * - A bounded retry, aware of both `finish_reason: "length"` and an
 *   entirely empty completion, handles truncation within a single batch
 *   (see MAX_ATTEMPTS) — kept separate from 429 handling (see
 *   MAX_RATE_LIMIT_ATTEMPTS), which retries the *same* request transparently
 *   inside callGroq when Groq is simply rate-limiting the account (a real,
 *   observed case: a 5-school batch can consume most of an 8000 TPM budget,
 *   so an immediately-following second batch may 429 even though it would
 *   succeed moments later).
 */
export class GroqProvider implements AiProvider {
  readonly name = 'groq';

  /** Global attempt counter for this provider instance (job-scoped via factory). */
  private attemptNumber = 0;

  constructor(
    private readonly config: AiResearchConfig,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    private readonly onAttempt?: OnAttemptCallback
  ) {}

  async extractSchools(input: SchoolExtractionInput): Promise<SchoolExtractionResult> {
    if (!this.config.groqApiKey) {
      throw new AiNotConfiguredError('Groq is not configured (missing GROQ_API_KEY).');
    }

    const batchSize = Math.max(1, this.config.groqBatchSize);
    if (input.requestedCount <= batchSize) {
      return this.extractBatch(input);
    }

    const collected: SchoolExtractionItem[] = [];
    const excludeNames = [...(input.excludeNames || [])];

    for (let batch = 0; batch < MAX_BATCHES && collected.length < input.requestedCount; batch++) {
      const remaining = input.requestedCount - collected.length;
      const batchInput: SchoolExtractionInput = { ...input, requestedCount: Math.min(batchSize, remaining), excludeNames };

      try {
        const result = await this.extractBatch(batchInput);
        if (!result.schools.length) break; // nothing more found this batch — stop rather than keep asking
        collected.push(...result.schools);
        excludeNames.push(...result.schools.map((school) => school.name));
      } catch (err) {
        if (collected.length === 0) throw err; // the very first batch failing fails the whole extraction (lets FallbackAiProvider take over)
        this.logIssue({ reason: 'batch-failed-after-partial-success', batch: batch + 1, collected: collected.length });
        break; // keep the partial results already found rather than discarding them
      }
    }

    return { schools: collected.slice(0, input.requestedCount) };
  }

  /** Runs one bounded, truncation-aware extraction request for up to config.groqBatchSize schools. */
  private async extractBatch(input: SchoolExtractionInput): Promise<SchoolExtractionResult> {
    const basePrompt = buildExtractionPrompt(input);
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const prompt = attempt === 1 ? basePrompt : `${basePrompt}${buildCompactRetryInstruction()}`;
      const startedAt = new Date();
      const t0 = performance.now();

      let callResult: GroqCallResult;
      try {
        callResult = await this.callGroq(prompt);
      } catch (err) {
        // callGroq itself emits usage for HTTP-level failures (429, other errors).
        // Re-throw so extractBatch/extractSchools handles it normally.
        throw err;
      }

      const { message, finishReason, inputTokens, outputTokens, totalTokens, isRetry } = callResult;
      const durationMs = Math.round(performance.now() - t0);
      const completedAt = new Date();
      const attemptNum = ++this.attemptNumber;
      const executedToolsRaw: unknown[] = Array.isArray(message?.executed_tools) ? message.executed_tools : [];
      const isAttemptRetry = attempt > 1 || Boolean(isRetry);

      if (!usedWebSearch(message)) {
        this.logIssue({ reason: 'no-web-search', attempt, finishReason });
        // Emit a FAILED usage record — no web search means we refuse the result
        this.emitUsage({
          attemptNumber: attemptNum,
          status: 'FAILED',
          durationMs,
          startedAt,
          completedAt,
          inputTokens,
          outputTokens,
          totalTokens,
          webSearches: 0,
          executedTools: executedToolsRaw,
          retry: isAttemptRetry,
          fallback: false,
          httpStatus: 200,
          errorCode: 'NO_WEB_SEARCH',
          errorMessage: 'Groq response did not perform a web search',
        });
        // Not a truncation problem — retrying with a "be more compact"
        // instruction won't make the model search. Fail immediately so
        // FallbackAiProvider can hand off to Gemini.
        throw new AiExtractionError('Groq response did not perform a web search — refusing to accept an ungrounded answer');
      }

      const content: string | undefined = message?.content;
      const contentLength = typeof content === 'string' ? content.length : 0;
      const hasMoreAttempts = attempt < MAX_ATTEMPTS;
      const webSearches = countWebSearches(message);

      // An entirely empty completion with finish_reason "stop" is the same
      // failure family as a truncated payload: the model's whole completion
      // budget was consumed by its internal tool-use/reasoning turns, leaving
      // nothing for the visible JSON answer. Retry immediately with the
      // compact-instruction prompt rather than wasting a parse attempt on it.
      if (contentLength === 0 && hasMoreAttempts) {
        this.logIssue({ reason: 'empty-response', attempt, finishReason });
        this.emitUsage({
          attemptNumber: attemptNum,
          status: 'FAILED',
          durationMs,
          startedAt,
          completedAt,
          inputTokens,
          outputTokens,
          totalTokens,
          webSearches,
          executedTools: executedToolsRaw,
          retry: isAttemptRetry,
          fallback: false,
          httpStatus: 200,
          errorCode: 'EMPTY_RESPONSE',
          errorMessage: 'Groq returned an empty completion',
        });
        continue;
      }

      try {
        const result = parseExtractionResponseText(content);
        // Success — emit usage
        this.emitUsage({
          attemptNumber: attemptNum,
          status: 'SUCCESS',
          durationMs,
          startedAt,
          completedAt,
          inputTokens,
          outputTokens,
          totalTokens,
          webSearches,
          executedTools: executedToolsRaw,
          retry: isAttemptRetry,
          fallback: false,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        });
        return result;
      } catch (err) {
        lastError = err;
        const truncated = err instanceof AiTruncatedResponseError || finishReason === 'length' || contentLength === 0;
        this.logIssue({
          reason: truncated ? 'truncated' : 'parse-failed',
          attempt,
          finishReason,
          contentLength,
          empty: contentLength === 0,
          parseErrorName: err instanceof Error ? err.name : typeof err,
        });

        this.emitUsage({
          attemptNumber: attemptNum,
          status: 'FAILED',
          durationMs,
          startedAt,
          completedAt,
          inputTokens,
          outputTokens,
          totalTokens,
          webSearches,
          executedTools: executedToolsRaw,
          retry: isAttemptRetry,
          fallback: false,
          httpStatus: 200,
          errorCode: truncated ? 'TRUNCATED_RESPONSE' : 'PARSE_ERROR',
          errorMessage: sanitizeErrorMessage(err instanceof Error ? err.message : String(err)),
        });

        if (truncated && hasMoreAttempts) {
          continue; // bounded retry with the compact-instruction prompt
        }
        throw err;
      }
    }

    // Unreachable (the loop always returns or throws), kept for type-safety.
    throw lastError instanceof Error ? lastError : new AiExtractionError('Groq extraction failed');
  }

  /**
   * Sends one request, transparently retrying on 429 (rate limit) a bounded
   * number of times — honoring Retry-After / Groq's reported wait when
   * available, otherwise a fixed short backoff. Any other non-2xx status is
   * NOT retried here (see extractBatch/extractSchools for what happens to
   * the resulting error).
   *
   * Usage records for HTTP-level failures (429, other errors) are emitted
   * here because callGroq has direct access to HTTP status codes.
   */
  private async callGroq(prompt: string): Promise<GroqCallResult> {
    for (let attempt = 1; attempt <= MAX_RATE_LIMIT_ATTEMPTS; attempt++) {
      const startedAt = new Date();
      const t0 = performance.now();
      const response = await this.sendRequest(prompt);
      const durationMs = Math.round(performance.now() - t0);
      const completedAt = new Date();

      if (response.status === 429) {
        let bodyText = '';
        try {
          bodyText = await response.text();
        } catch {
          // ignore
        }

        const attemptNum = ++this.attemptNumber;
        this.emitUsage({
          attemptNumber: attemptNum,
          status: 'RATE_LIMITED',
          durationMs,
          startedAt,
          completedAt,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          webSearches: 0,
          executedTools: null,
          retry: attempt > 1,
          fallback: false,
          httpStatus: 429,
          errorCode: 'RATE_LIMITED',
          errorMessage: sanitizeErrorMessage(bodyText.slice(0, 300) || 'Groq rate limit exceeded'),
        });

        if (attempt >= MAX_RATE_LIMIT_ATTEMPTS) {
          this.logIssue({ reason: 'rate-limit-exhausted', attempt });
          throw new AiExtractionError(`Groq returned status 429${bodyText ? `: ${bodyText.slice(0, 300)}` : ''}`);
        }

        const signaledMs = parseRetryAfterMs(response, bodyText);
        const backoffMs = RATE_LIMIT_BACKOFF_MS[Math.min(attempt - 1, RATE_LIMIT_BACKOFF_MS.length - 1)];
        const waitMs = Math.min(MAX_RATE_LIMIT_WAIT_MS, signaledMs ?? backoffMs);

        this.logIssue({ reason: 'rate-limit-retry', attempt, waitMs, waitSource: signaledMs !== null ? 'retry-after' : 'backoff' });
        await this.sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        let detail = '';
        try {
          detail = await response.text();
        } catch {
          // ignore
        }
        this.logIssue({ reason: 'http-error', status: response.status });

        const attemptNum = ++this.attemptNumber;
        this.emitUsage({
          attemptNumber: attemptNum,
          status: 'FAILED',
          durationMs,
          startedAt,
          completedAt,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          webSearches: 0,
          executedTools: null,
          retry: attempt > 1,
          fallback: false,
          httpStatus: response.status,
          errorCode: `HTTP_${response.status}`,
          errorMessage: sanitizeErrorMessage(detail.slice(0, 300) || `Groq returned status ${response.status}`),
        });

        throw new AiExtractionError(`Groq returned status ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`);
      }

      let payload: any;
      try {
        payload = await response.json();
      } catch (err) {
        throw new AiExtractionError('Groq returned a non-JSON response envelope', err);
      }

      const choice = payload?.choices?.[0];
      const usage = payload?.usage;

      return {
        message: choice?.message,
        finishReason: choice?.finish_reason ?? null,
        // Read actual token counts from payload.usage — never estimated
        inputTokens: typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : null,
        outputTokens: typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : null,
        totalTokens: typeof usage?.total_tokens === 'number' ? usage.total_tokens : null,
        isRetry: attempt > 1,
      };
    }

    // Unreachable (the loop always returns or throws), kept for type-safety.
    throw new AiExtractionError('Groq rate-limit retry loop exited unexpectedly');
  }

  private async sendRequest(prompt: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      return await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.groqApiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.config.groqModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_completion_tokens: this.config.groqMaxCompletionTokens,
        }),
      });
    } catch (err) {
      if (controller.signal.aborted) {
        throw new AiExtractionError('Groq request timed out', err);
      }
      throw new AiExtractionError('Groq request failed', err);
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Emits a usage record to the onAttempt callback (if installed). Never throws. */
  private emitUsage(fields: Omit<ResearchUsage, 'provider' | 'model'>): void {
    if (!this.onAttempt) return;
    try {
      this.onAttempt({
        provider: 'groq',
        model: this.config.groqModel,
        ...fields,
      });
    } catch {
      // Usage callback errors must never surface to research logic
    }
  }

  /** Diagnostic-only logging: model + shape/size signals, never the prompt, response content, or API key. */
  private logIssue(details: Record<string, unknown>) {
    console.warn('[GroqProvider] extraction issue', { model: this.config.groqModel, ...details });
  }
}
