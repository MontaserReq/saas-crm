export interface ConfidenceInput {
  hasWebsite: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  hasAddress: boolean;
  hasOfficialWebsiteSource: boolean;
  distinctSourceHostCount: number;
}

/**
 * Transparent, evidence-based confidence score (0-100). Not an opaque AI
 * number: every point is attributable to a specific verified signal.
 *
 * v1 has no Google Maps/Places integration (see known limitations), so the
 * spec's "Google Maps match +15" factor is replaced with "an official
 * school-website source was cited" (+15) — still an independent-source
 * signal, just sourced from search grounding instead of a Maps API.
 */
export function computeConfidence(input: ConfidenceInput): number {
  let score = 0;
  if (input.hasWebsite) score += 25;
  if (input.hasPhone) score += 20;
  if (input.hasEmail) score += 15;
  if (input.hasAddress) score += 15;
  if (input.hasOfficialWebsiteSource) score += 15;
  if (input.distinctSourceHostCount >= 2) score += 10;
  return Math.min(100, score);
}

export interface ReadinessInput {
  hasCity: boolean;
  hasAnyContactMethod: boolean;
  hasEvidence: boolean;
}

/**
 * Initial candidate status right after extraction/normalization, before
 * duplicate detection runs (which may further downgrade NEW to DUPLICATE).
 * "Ready" (NEW) requires: name (always present), a city, at least one
 * contact method, and at least one cited source. Anything weaker needs
 * a human to review it before it can be approved.
 */
export function determineInitialCandidateStatus(input: ReadinessInput): 'NEW' | 'NEEDS_REVIEW' {
  if (!input.hasCity || !input.hasAnyContactMethod || !input.hasEvidence) return 'NEEDS_REVIEW';
  return 'NEW';
}
