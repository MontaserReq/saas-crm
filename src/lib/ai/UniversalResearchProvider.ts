import { AiProvider, SchoolExtractionInput, SchoolExtractionResult } from './types';
import { buildExtractionPrompt, parseExtractionResponseText } from './shared';
import { UniversalAiGateway } from './gateway';
import type { OnAttemptCallback } from './usage';

/** Adapts every gateway protocol to the existing School Research contract. */
export class UniversalResearchProvider implements AiProvider {
  readonly name: string;

  constructor(private readonly providerId?: string, private readonly onAttempt?: OnAttemptCallback) {
    this.name = providerId || 'universal-ai-gateway';
  }

  async extractSchools(input: SchoolExtractionInput): Promise<SchoolExtractionResult> {
    const response = await UniversalAiGateway.generate({
      providerId: this.providerId,
      purpose: 'smart-lead-discovery',
      temperature: 0.2,
      maxOutputTokens: 8192,
      messages: [{ role: 'user', content: buildExtractionPrompt(input) }],
    });
    try {
      await this.onAttempt?.({
        provider: response.providerId,
        model: response.model,
        attemptNumber: 1,
        status: 'SUCCESS',
        durationMs: response.durationMs,
        startedAt: new Date(Date.now() - response.durationMs),
        completedAt: new Date(),
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        totalTokens: response.totalTokens,
        webSearches: 0,
        executedTools: null,
        retry: false,
        fallback: false,
        httpStatus: 200,
        errorCode: null,
        errorMessage: null,
      });
    } catch { /* usage instrumentation must not break discovery */ }
    return parseExtractionResponseText(response.content);
  }
}
