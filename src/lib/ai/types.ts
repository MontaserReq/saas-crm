import { z } from 'zod';

/**
 * AI provider abstraction for AI School Research. The rest of the app never
 * talks to a specific AI SDK/vendor directly — only through this interface —
 * so a future OpenAIProvider/AnthropicProvider can be added without touching
 * the research pipeline.
 */
export interface SchoolExtractionInput {
  location: string;
  area?: string | null;
  schoolType?: string | null;
  requestedCount: number;
  requiredFields: string[];
  /** Names already collected in this job, to reduce duplicate search hits. */
  excludeNames?: string[];
}

export const schoolExtractionEvidenceSchema = z.object({
  field: z.string(),
  source: z.string(),
  sourceUrl: z.string().url().nullable().optional().default(null),
});

export const schoolExtractionItemSchema = z.object({
  name: z.string().min(1),
  city: z.string().nullable().optional().default(null),
  area: z.string().nullable().optional().default(null),
  phone: z.string().nullable().optional().default(null),
  email: z.string().nullable().optional().default(null),
  website: z.string().nullable().optional().default(null),
  schoolType: z.string().nullable().optional().default(null),
  address: z.string().nullable().optional().default(null),
  contactPerson: z.string().nullable().optional().default(null),
  evidence: z.array(schoolExtractionEvidenceSchema).default([]),
});

export const schoolExtractionResultSchema = z.object({
  schools: z.array(schoolExtractionItemSchema).default([]),
});

export type SchoolExtractionEvidence = z.infer<typeof schoolExtractionEvidenceSchema>;
export type SchoolExtractionItem = z.infer<typeof schoolExtractionItemSchema>;
export type SchoolExtractionResult = z.infer<typeof schoolExtractionResultSchema>;

export interface AiProvider {
  readonly name: string;
  extractSchools(input: SchoolExtractionInput): Promise<SchoolExtractionResult>;
}

/** Thrown when no AI provider is configured (e.g. missing API key). Never falls back to fake data. */
export class AiNotConfiguredError extends Error {
  constructor(message = 'AI Research is not configured yet. Please configure the AI provider.') {
    super(message);
    this.name = 'AiNotConfiguredError';
  }
}

/** Thrown for a single failed extraction attempt (network, timeout, malformed/hallucinated JSON). */
export class AiExtractionError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'AiExtractionError';
  }
}

/**
 * A specific, narrower AiExtractionError: the model's response was cut off
 * before the JSON object was closed (almost always an output token limit).
 * Distinguished from other extraction failures so a provider can decide to
 * retry once with a more compact prompt instead of giving up immediately.
 */
export class AiTruncatedResponseError extends AiExtractionError {
  constructor(message = 'AI response was truncated before the JSON was closed', cause?: unknown) {
    super(message, cause);
    this.name = 'AiTruncatedResponseError';
  }
}
