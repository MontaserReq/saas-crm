import { describe, expect, it } from 'vitest';
import { parseIntent, queriesFor } from '@/server/services/LeadDiscoveryService';

describe('Smart Lead Discovery intent and query planning', () => {
  it('preserves explicit Arabic/English filters and requested fields', () => {
    expect(parseIntent({ prompt: 'ابحث عن 30 وكالة تسويق صغيرة في الأردن', requestedCount: 30, country: 'Jordan', city: 'Amman', industry: 'Digital marketing', requiredFields: ['website', 'email'] })).toMatchObject({ requestedCount: 30, country: 'Jordan', city: 'Amman', industry: 'Digital marketing', requiredFields: ['website', 'email'] });
  });

  it('creates multiple targeted, de-duplicated queries', () => {
    const queries = queriesFor('Find agencies', { industry: 'digital marketing', country: 'Jordan', city: 'Amman', companySize: 'sme', requestedCount: 20, requiredFields: ['website'] });
    expect(queries).toHaveLength(3);
    expect(new Set(queries).size).toBe(queries.length);
    expect(queries.every((query) => query.includes('Amman') && query.includes('Jordan'))).toBe(true);
  });
});
