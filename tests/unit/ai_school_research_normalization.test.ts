import { describe, expect, it } from 'vitest';
import { normalizeSchoolName, normalizeResearchPhone, normalizeResearchEmail, extractWebsiteDomain } from '@/lib/ai-school-research/normalize';

describe('AI School Research: normalization', () => {
  it.each([
    ['مدارس آيلا العالمية', 'مدارس آيلا العالمية'],
    ['  مدارس   النمو   التربوي  ', 'مدارس النمو التربوي'],
    ['مدراس و أكاديمية أجيال العلم', 'مدراس و أكاديمية أجيال العلم'],
    ['المستقلة الدولية - فرع خلدا', 'المستقلة الدولية - فرع خلدا'],
  ])('normalizes Arabic school name whitespace consistently: %s', (input, expected) => {
    expect(normalizeSchoolName(input)).toBe(normalizeSchoolName(expected));
  });

  it('is case-insensitive for Latin names and trims/collapses whitespace', () => {
    expect(normalizeSchoolName('  XYZ International   School ')).toBe(normalizeSchoolName('xyz international school'));
  });

  it('treats null/undefined/empty as an empty string', () => {
    expect(normalizeSchoolName(null)).toBe('');
    expect(normalizeSchoolName(undefined)).toBe('');
    expect(normalizeSchoolName('')).toBe('');
  });

  it.each([
    ['0799631111 رقم الاستقبال', '0799631111'],
    ['(06) 553 5190', '065535190'],
    ['07 7042 4100', '0770424100'],
    ['+962780728761', '0780728761'],
    ['962790203683', '0790203683'],
  ])('normalizes realistic Jordanian phone formats: %s -> %s', (input, expected) => {
    expect(normalizeResearchPhone(input)).toBe(expected);
  });

  it('does not fabricate digits for an unparseable phone value', () => {
    expect(normalizeResearchPhone('call the school')).toBe('');
  });

  it('normalizes email casing/whitespace and rejects malformed values instead of guessing', () => {
    expect(normalizeResearchEmail('  Info@XYZ.edu.jo ')).toBe('info@xyz.edu.jo');
    expect(normalizeResearchEmail('not-an-email')).toBeNull();
    expect(normalizeResearchEmail(null)).toBeNull();
    expect(normalizeResearchEmail('')).toBeNull();
  });

  it.each([
    ['https://www.xyzschool.edu.jo/contact', 'xyzschool.edu.jo'],
    ['http://xyzschool.edu.jo', 'xyzschool.edu.jo'],
    ['xyzschool.edu.jo', 'xyzschool.edu.jo'],
  ])('extracts a normalized website domain from %s', (input, expected) => {
    expect(extractWebsiteDomain(input)).toBe(expected);
  });

  it('returns null for an invalid or missing website rather than guessing', () => {
    expect(extractWebsiteDomain(null)).toBeNull();
    expect(extractWebsiteDomain('not a url at all !!')).toBeNull();
  });
});
