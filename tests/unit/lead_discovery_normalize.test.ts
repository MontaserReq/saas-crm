import { describe, expect, it } from 'vitest';
import { completeness, normalizeDomain, normalizeEmail, normalizeName, normalizePhone, scoreLead } from '@/lib/lead-discovery/normalize';

describe('Smart Lead Discovery deterministic normalization', () => {
  it('normalizes identity fields without treating malformed contact data as valid', () => {
    expect(normalizeName('  Acme,   Digital  ')).toBe('acme digital');
    expect(normalizeDomain('https://www.Acme.example/path')).toBe('acme.example');
    expect(normalizeEmail(' SALES@Acme.Example ')).toBe('sales@acme.example');
    expect(normalizeEmail('not-an-email')).toBeNull();
    expect(normalizePhone('+962 (79) 123-4567')).toBe('962791234567');
  });

  it('calculates completeness and an explainable score', () => {
    expect(completeness(['website', null, 'phone'])).toBe(67);
    const scored = scoreLead({ prompt: 'digital agencies in Amman Jordan', companyName: 'Acme', industry: 'digital agencies', city: 'Amman', country: 'Jordan', website: 'https://acme.example', email: 'sales@acme.example', phone: null, sourceCount: 2 });
    expect(scored.score).toBeGreaterThanOrEqual(80);
    expect(scored.reason).toContain('industry matches request');
  });
});
