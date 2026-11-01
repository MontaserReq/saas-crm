import { AiExtractionError, AiNotConfiguredError, AiProvider, SchoolExtractionInput, SchoolExtractionResult } from './types';
import type { AiResearchProviderConfig } from './researchSettings';
import { buildExtractionPrompt, parseExtractionResponseText } from './shared';
import { OnAttemptCallback, ResearchUsage, sanitizeErrorMessage } from './usage';
import { ResearchBudgetExceededError } from '@/lib/security/resourceGuard';

const REQUEST_TIMEOUT_MS = 45_000;

/**
 * Adapter for providers exposing the common OpenAI chat-completions contract.
 * This covers OpenAI, Together, OpenRouter, DeepSeek, Mistral, Ollama and
 * most hosted/local gateways without adding a vendor-specific adapter.
 */
export class OpenAICompatibleProvider implements AiProvider {
  readonly name: string;
  private attemptNumber = 0;

  constructor(
    private readonly provider: AiResearchProviderConfig,
    private readonly onAttempt?: OnAttemptCallback,
  ) {
    this.name = provider.id;
  }

  async extractSchools(input: SchoolExtractionInput): Promise<SchoolExtractionResult> {
    if (!this.provider.apiKey) throw new AiNotConfiguredError(`Provider "${this.provider.name}" is missing an API key.`);
    if (!this.provider.baseUrl) throw new AiNotConfiguredError(`Provider "${this.provider.name}" is missing a base URL.`);
    if (!this.provider.model) throw new AiNotConfiguredError(`Provider "${this.provider.name}" is missing a model.`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const startedAt = new Date();
    const t0 = performance.now();
    const attemptNumber = ++this.attemptNumber;
    let response: Response;

    try {
      await input.beforeRequest?.(false);
      response = await fetch(`${this.provider.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.provider.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.provider.model,
          messages: [{ role: 'user', content: buildExtractionPrompt(input) }],
          temperature: 0.2,
          max_tokens: 8192,
        }),
      });
    } catch (err) {
      const durationMs = Math.round(performance.now() - t0);
      await this.emitUsage({
        attemptNumber,
        status: 'FAILED',
        durationMs,
        startedAt,
        completedAt: new Date(),
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        webSearches: 0,
        executedTools: null,
        retry: false,
        fallback: false,
        httpStatus: null,
        errorCode: controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
        errorMessage: sanitizeErrorMessage(err instanceof Error ? err.message : String(err)),
      });
      if (controller.signal.aborted) throw new AiExtractionError('AI provider request timed out', err);
      throw new AiExtractionError('AI provider request failed', err);
    } finally {
      clearTimeout(timeout);
    }

    const durationMs = Math.round(performance.now() - t0);
    const completedAt = new Date();
    if (!response.ok) {
      let detail = '';
      try { detail = await response.text(); } catch { /* ignore provider body errors */ }
      await this.emitUsage({
        attemptNumber,
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
        fallback: false,
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
        attemptNumber,
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
        fallback: false,
        httpStatus: response.status,
        errorCode: 'PARSE_ERROR',
        errorMessage: 'Provider returned a non-JSON response envelope',
      });
      throw new AiExtractionError('AI provider returned a non-JSON response envelope', err);
    }

    const messageContent = payload?.choices?.[0]?.message?.content;
    const text = Array.isArray(messageContent)
      ? messageContent.map((part: any) => typeof part === 'string' ? part : part?.text || '').join('')
      : typeof messageContent === 'string' ? messageContent : undefined;
    const usage = payload?.usage;

    try {
      const result = parseExtractionResponseText(text);
      await this.emitUsage({
        attemptNumber,
        status: 'SUCCESS',
        durationMs,
        startedAt,
        completedAt,
        inputTokens: typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : null,
        outputTokens: typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : null,
        totalTokens: typeof usage?.total_tokens === 'number' ? usage.total_tokens : null,
        webSearches: 0,
        executedTools: Array.isArray(payload?.choices?.[0]?.message?.tool_calls) ? payload.choices[0].message.tool_calls : null,
        retry: false,
        fallback: false,
        httpStatus: response.status,
        errorCode: null,
        errorMessage: null,
      });
      return result;
    } catch (err) {
      await this.emitUsage({
        attemptNumber,
        status: 'FAILED',
        durationMs,
        startedAt,
        completedAt,
        inputTokens: typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : null,
        outputTokens: typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : null,
        totalTokens: typeof usage?.total_tokens === 'number' ? usage.total_tokens : null,
        webSearches: 0,
        executedTools: null,
        retry: false,
        fallback: false,
        httpStatus: response.status,
        errorCode: 'PARSE_ERROR',
        errorMessage: sanitizeErrorMessage(err instanceof Error ? err.message : String(err)),
      });
      if (err instanceof ResearchBudgetExceededError) throw err;
      throw err;
    }
  }

  private async emitUsage(fields: Omit<ResearchUsage, 'provider' | 'model'>): Promise<void> {
    if (!this.onAttempt) return;
    try {
      await this.onAttempt({ provider: this.provider.id, model: this.provider.model, ...fields });
    } catch (error) {
      if (error instanceof ResearchBudgetExceededError) throw error;
    }
  }
}
