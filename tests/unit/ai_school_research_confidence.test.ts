import { describe, expect, it } from 'vitest';
import { computeConfidence, determineInitialCandidateStatus } from '@/lib/ai-school-research/confidence';

describe('AI School Research: confidence scoring', () => {
  it('scores zero when no evidence exists', () => {
    expect(
      computeConfidence({ hasWebsite: false, hasPhone: false, hasEmail: false, hasAddress: false, hasOfficialWebsiteSource: false, distinctSourceHostCount: 0 })
    ).toBe(0);
  });

  it('sums each independent evidence factor transparently', () => {
    expect(
      computeConfidence({ hasWebsite: true, hasPhone: false, hasEmail: false, hasAddress: false, hasOfficialWebsiteSource: false, distinctSourceHostCount: 0 })
    ).toBe(25);
    expect(
      computeConfidence({ hasWebsite: false, hasPhone: true, hasEmail: false, hasAddress: false, hasOfficialWebsiteSource: false, distinctSourceHostCount: 0 })
    ).toBe(20);
    expect(
      computeConfidence({ hasWebsite: false, hasPhone: false, hasEmail: true, hasAddress: false, hasOfficialWebsiteSource: false, distinctSourceHostCount: 0 })
    ).toBe(15);
    expect(
      computeConfidence({ hasWebsite: false, hasPhone: false, hasEmail: false, hasAddress: true, hasOfficialWebsiteSource: false, distinctSourceHostCount: 0 })
    ).toBe(15);
    expect(
      computeConfidence({ hasWebsite: false, hasPhone: false, hasEmail: false, hasAddress: false, hasOfficialWebsiteSource: true, distinctSourceHostCount: 0 })
    ).toBe(15);
    expect(
      computeConfidence({ hasWebsite: false, hasPhone: false, hasEmail: false, hasAddress: false, hasOfficialWebsiteSource: false, distinctSourceHostCount: 2 })
    ).toBe(10);
  });

  it('caps the total score at 100 even if every factor is present', () => {
    expect(
      computeConfidence({ hasWebsite: true, hasPhone: true, hasEmail: true, hasAddress: true, hasOfficialWebsiteSource: true, distinctSourceHostCount: 5 })
    ).toBe(100);
  });

  it('is not an opaque AI number — it is fully derived from the input evidence flags', () => {
    const a = computeConfidence({ hasWebsite: true, hasPhone: true, hasEmail: false, hasAddress: false, hasOfficialWebsiteSource: false, distinctSourceHostCount: 0 });
    const b = computeConfidence({ hasWebsite: true, hasPhone: true, hasEmail: false, hasAddress: false, hasOfficialWebsiteSource: false, distinctSourceHostCount: 0 });
    expect(a).toBe(b);
    expect(a).toBe(45);
  });
});

describe('AI School Research: candidate readiness', () => {
  it('is NEW ("Ready") only when city, a contact method, and evidence all exist', () => {
    expect(determineInitialCandidateStatus({ hasCity: true, hasAnyContactMethod: true, hasEvidence: true })).toBe('NEW');
  });

  it.each([
    [{ hasCity: false, hasAnyContactMethod: true, hasEvidence: true }],
    [{ hasCity: true, hasAnyContactMethod: false, hasEvidence: true }],
    [{ hasCity: true, hasAnyContactMethod: true, hasEvidence: false }],
  ])('falls back to NEEDS_REVIEW when a signal is missing: %o', (input) => {
    expect(determineInitialCandidateStatus(input)).toBe('NEEDS_REVIEW');
  });
});
