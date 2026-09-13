import { describe, expect, it } from 'vitest';
import { isLikelyDuplicate } from '@/lib/ai-school-research/duplicate';

describe('AI School Research: duplicate detection', () => {
  it('flags an exact normalized name + matching city as a duplicate', () => {
    expect(
      isLikelyDuplicate(
        { name: 'مدارس آيلا العالمية', city: 'عمان', phone: null, website: null },
        { name: '  مدارس   آيلا   العالمية ', city: 'عمان', phone: null, website: null }
      )
    ).toBe(true);
  });

  it('flags a matching name even without a city on one side (cannot rule it out)', () => {
    expect(
      isLikelyDuplicate({ name: 'Ayla International School', city: null, phone: null, website: null }, { name: 'ayla international school', city: 'Amman', phone: null, website: null })
    ).toBe(true);
  });

  it('does not flag the same name in two different cities as a duplicate', () => {
    expect(
      isLikelyDuplicate({ name: 'المستقلة الدولية - فرع خلدا', city: 'عمان', phone: null, website: null }, { name: 'المستقلة الدولية - فرع خلدا', city: 'إربد', phone: null, website: null })
    ).toBe(false);
  });

  it('flags a matching normalized phone number regardless of formatting', () => {
    expect(
      isLikelyDuplicate({ name: 'XYZ School', city: 'Amman', phone: '07 7042 4100', website: null }, { name: 'XYZ Intl School', city: 'Amman', phone: '0770424100', website: null })
    ).toBe(true);
  });

  it('flags a matching website domain regardless of protocol/www/path', () => {
    expect(
      isLikelyDuplicate({ name: 'XYZ School', city: null, phone: null, website: 'https://www.xyzschool.edu.jo/contact' }, { name: 'XYZ Intl', city: null, phone: null, website: 'http://xyzschool.edu.jo' })
    ).toBe(true);
  });

  it('does not flag two genuinely different schools as duplicates', () => {
    expect(
      isLikelyDuplicate(
        { name: 'مدارس النمو التربوي', city: 'عمان', phone: '0791111111', website: null },
        { name: 'مدراس و أكاديمية أجيال العلم', city: 'إربد', phone: '0792222222', website: null }
      )
    ).toBe(false);
  });

  it('never matches on an empty/short phone value', () => {
    expect(isLikelyDuplicate({ name: 'A School', city: 'Amman', phone: '', website: null }, { name: 'Different School', city: 'Zarqa', phone: '', website: null })).toBe(false);
  });
});
