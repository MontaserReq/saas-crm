import { AiExtractionError, AiNotConfiguredError, AiProvider, SchoolExtractionInput, SchoolExtractionResult } from './types';
import { AiResearchConfig } from './config';
import { buildExtractionPrompt, parseExtractionResponseText } from './shared';
import { OnAttemptCallback, ResearchUsage, sanitizeErrorMessage } from './usage';
import { ResearchBudgetExceededError } from '@/lib/security/resourceGuard';

// Re-exported for backward compatibility — some tests import extractJsonPayload from this file directly.
export { extractJsonPayload } from './shared';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const REQUEST_TIMEOUT_MS = 45_000;

export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';

  private attemptNumber = 0;

  constructor(
    private readonly config: AiResearchConfig,
    private readonly onAttempt?: OnAttemptCallback,
    private readonly isFallback: boolean = false
  ) {}

  async extractSchools(input: SchoolExtractionInput): Promise<SchoolExtractionResult> {
    if (!this.config.geminiApiKey) {
      throw new AiNotConfiguredError();
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const startedAt = new Date();
    const t0 = performance.now();
    const attemptNum = ++this.attemptNumber;

    let response: Response;
    try {
      await input.beforeRequest?.(false);
      response = await fetch(
        `${GEMINI_API_BASE}/${encodeURIComponent(this.config.geminiModel)}:generateContent?key=${encodeURIComponent(this.config.geminiApiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: buildExtractionPrompt(input) }] }],
            tools: [{ google_search: {} }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
          }),
        }
      );
    } catch (err) {
      const durationMs = Math.round(performance.now() - t0);
      const completedAt = new Date();
      const isTimeout = controller.signal.aborted;

      await this.emitUsage({
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
        retry: false,
        fallback: this.isFallback,
        httpStatus: null,
        errorCode: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
        errorMessage: sanitizeErrorMessage(err instanceof Error ? err.message : String(err)),
      });

      clearTimeout(timeout);
      if (isTimeout) throw new AiExtractionError('AI provider request timed out', err);
      throw new AiExtractionError('AI provider request failed', err);
    } finally {
      clearTimeout(timeout);
    }

    const durationMs = Math.round(performance.now() - t0);
    const completedAt = new Date();

    if (!response.ok) {
      let detail = '';
      try {
        detail = await response.text();
      } catch {
        // ignore
      }

      await this.emitUsage({
        attemptNumber: attemptNum,
        status: response.status === 429 ? 'RATE_LIMITED' : 'FAILED',
        durationMs,
        startedAt,
        completedAt,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        webSearches: 0,
        executedTools: null,
        retry: false,
        fallback: this.isFallback,
        httpStatus: response.status,
        errorCode: response.status === 429 ? 'RATE_LIMITED' : `HTTP_${response.status}`,
        errorMessage: sanitizeErrorMessage(detail.slice(0, 300) || `AI provider returned status ${response.status}`),
      });

      throw new AiExtractionError(`AI provider returned status ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`);
    }

    let payload: any;
    try {
      payload = await response.json();
    } catch (err) {
      await this.emitUsage({
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
        retry: false,
        fallback: this.isFallback,
        httpStatus: response.status,
        errorCode: 'PARSE_ERROR',
        errorMessage: 'Gemini returned a non-JSON response envelope',
      });
      throw new AiExtractionError('AI provider returned a non-JSON response envelope', err);
    }

    const text: string | undefined = payload?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part?.text || '')
      .join('');

    // --- Extract usage metadata (never estimated) ---
    const usageMeta = payload?.usageMetadata;
    const inputTokens: number | null = typeof usageMeta?.promptTokenCount === 'number' ? usageMeta.promptTokenCount : null;
    const outputTokens: number | null = typeof usageMeta?.candidatesTokenCount === 'number' ? usageMeta.candidatesTokenCount : null;
    const totalTokens: number | null = typeof usageMeta?.totalTokenCount === 'number' ? usageMeta.totalTokenCount : null;

    // Count web searches from groundingMetadata.webSearchQueries (Gemini-specific)
    const groundingMeta = payload?.candidates?.[0]?.groundingMetadata;
    const webSearchQueries: unknown[] = Array.isArray(groundingMeta?.webSearchQueries) ? groundingMeta.webSearchQueries : [];
    const webSearches = webSearchQueries.length;

    try {
      const result = parseExtractionResponseText(text);

      await this.emitUsage({
        attemptNumber: attemptNum,
        status: 'SUCCESS',
        durationMs,
        startedAt,
        completedAt,
        inputTokens,
        outputTokens,
        totalTokens,
        webSearches,
        executedTools: null, // Gemini uses groundingMetadata, not executed_tools
        retry: false,
        fallback: this.isFallback,
        httpStatus: 200,
        errorCode: null,
        errorMessage: null,
      });

      return result;
    } catch (err) {
      await this.emitUsage({
        attemptNumber: attemptNum,
        status: 'FAILED',
        durationMs,
        startedAt,
        completedAt,
        inputTokens,
        outputTokens,
        totalTokens,
        webSearches,
        executedTools: null,
        retry: false,
        fallback: this.isFallback,
        httpStatus: 200,
        errorCode: 'PARSE_ERROR',
        errorMessage: sanitizeErrorMessage(err instanceof Error ? err.message : String(err)),
      });
      throw err;
    }
  }

  /** Emits a usage record to the onAttempt callback (if installed). Never throws. */
  private async emitUsage(fields: Omit<ResearchUsage, 'provider' | 'model'>): Promise<void> {
    if (!this.onAttempt) return;
    try {
      await this.onAttempt({
        provider: 'gemini',
        model: this.config.geminiModel,
        ...fields,
      });
    } catch (error) {
      if (error instanceof ResearchBudgetExceededError) throw error;
      // Usage callback errors must never surface to research logic
    }
  }
}
