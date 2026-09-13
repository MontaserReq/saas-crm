import { AiExtractionError, AiNotConfiguredError, AiProvider, SchoolExtractionInput, SchoolExtractionResult } from './types';
import { GeminiProvider } from './GeminiProvider';
import { OnAttemptCallback } from './usage';

/**
 * Wraps a primary provider with a fallback. If the primary is unconfigured,
 * unavailable, rate-limited, or returns a provider/validation failure, the
 * exact same extraction is retried against the fallback. If both fail, the
 * failure is surfaced clearly — never fabricated data.
 *
 * Usage tracking: the onAttempt callback is passed through to both providers.
 * The fallback provider (Gemini) is constructed with isFallback=true so its
 * usage records are correctly flagged.
 */
export class FallbackAiProvider implements AiProvider {
  readonly name: string;

  constructor(
    private readonly primary: AiProvider,
    private readonly fallback: AiProvider,
    private readonly onAttempt?: OnAttemptCallback
  ) {
    this.name = `${primary.name}(fallback:${fallback.name})`;
  }

  async extractSchools(input: SchoolExtractionInput): Promise<SchoolExtractionResult> {
    try {
      return await this.primary.extractSchools(input);
    } catch (primaryErr) {
      // Only fall back on known, provider-level failure modes. An unexpected
      // error type is rethrown as-is rather than silently masked.
      if (!(primaryErr instanceof AiNotConfiguredError) && !(primaryErr instanceof AiExtractionError)) {
        throw primaryErr;
      }

      try {
        return await this.fallback.extractSchools(input);
      } catch (fallbackErr) {
        if (primaryErr instanceof AiNotConfiguredError && fallbackErr instanceof AiNotConfiguredError) {
          throw new AiNotConfiguredError('AI Research is not configured yet. Please configure the AI provider.');
        }
        const primaryMessage = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
        const fallbackMessage = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        throw new AiExtractionError(
          `Both AI providers failed. ${this.primary.name}: ${primaryMessage}. ${this.fallback.name}: ${fallbackMessage}`,
          fallbackErr
        );
      }
    }
  }
}

/**
 * Creates a FallbackAiProvider that correctly wires the onAttempt callback
 * through to both providers, with the fallback Gemini provider tagged as
 * isFallback=true.
 *
 * This factory is used by getAiProvider() so that callers don't need to know
 * the internal provider construction details.
 */
export function createFallbackProvider(
  primary: AiProvider,
  fallbackConfig: ConstructorParameters<typeof GeminiProvider>[0],
  onAttempt?: OnAttemptCallback
): FallbackAiProvider {
  // Reconstruct Gemini with isFallback=true so its usage records are flagged
  const fallbackWithFlag = new GeminiProvider(fallbackConfig, onAttempt, true);
  return new FallbackAiProvider(primary, fallbackWithFlag, onAttempt);
}
