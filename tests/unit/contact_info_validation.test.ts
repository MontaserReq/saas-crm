import { describe, expect, it } from 'vitest';
import {
  emailSchema,
  normalizeInternationalPhone,
  optionalEmailSchema,
  optionalInternationalPhoneListSchema,
  optionalInternationalPhoneSchema,
} from '@/lib/validation';

describe('contact information validation', () => {
  it('normalizes valid international numbers from different countries to E.164', () => {
    expect(optionalInternationalPhoneSchema.parse('+962 79 000 0000')).toBe('+962790000000');
    expect(optionalInternationalPhoneSchema.parse('0044 20 7946 0018')).toBe('+442079460018');
    expect(optionalInternationalPhoneSchema.parse('+1 (202) 555-0123')).toBe('+12025550123');
    expect(optionalInternationalPhoneSchema.parse('+81 3-1234-5678')).toBe('+81312345678');
  });

  it('accepts Arabic and Eastern Arabic digits', () => {
    expect(normalizeInternationalPhone('+٩٦٢ ٧٩ ٠٠٠ ٠٠٠٠')).toBe('+962790000000');
    expect(normalizeInternationalPhone('+۹۶۲ ۷۹ ۰۰۰ ۰۰۰۰')).toBe('+962790000000');
  });

  it('rejects local, impossible, and malformed phone numbers', () => {
    for (const value of ['0790000000', '+999123456789', '+962 12', 'phone']) {
      expect(optionalInternationalPhoneSchema.safeParse(value).success).toBe(false);
    }
  });

  it('normalizes lists of school numbers and rejects an invalid member', () => {
    expect(optionalInternationalPhoneListSchema.parse('+962790000000, 00442079460018')).toBe('+962790000000, +442079460018');
    expect(optionalInternationalPhoneListSchema.safeParse('+962790000000, 0790000000').success).toBe(false);
  });

  it('normalizes emails and keeps optional fields nullable', () => {
    expect(emailSchema.parse('  Owner@Example.COM ')).toBe('owner@example.com');
    expect(optionalEmailSchema.parse('')).toBeNull();
    expect(optionalInternationalPhoneSchema.parse(null)).toBeNull();
    expect(optionalEmailSchema.safeParse('not-an-email').success).toBe(false);
  });
});
