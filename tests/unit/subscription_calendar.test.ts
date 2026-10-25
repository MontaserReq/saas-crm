import { describe, expect, it } from 'vitest';
import { addUtcCalendarMonths } from '@/lib/platform/upgrades';

describe('UTC paid-subscription calendar periods', () => {
  it.each([
    ['ordinary monthly period', '2026-10-15T09:30:45.123Z', 1, '2026-11-15T09:30:45.123Z'],
    ['31-day month into February', '2026-01-31T23:59:59.999Z', 1, '2026-02-28T23:59:59.999Z'],
    ['leap-year January into February', '2024-01-31T08:15:00.000Z', 1, '2024-02-29T08:15:00.000Z'],
    ['leap day annual period', '2024-02-29T12:00:00.000Z', 12, '2025-02-28T12:00:00.000Z'],
    ['annual period spanning a leap year', '2023-03-01T00:00:00.000Z', 12, '2024-03-01T00:00:00.000Z'],
  ])('%s', (_label, start, months, expected) => {
    expect(addUtcCalendarMonths(new Date(start), months).toISOString()).toBe(expected);
  });

  it('rejects non-positive or fractional billing periods', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    for (const months of [0, -1, 1.5]) expect(() => addUtcCalendarMonths(start, months)).toThrow('INVALID_BILLING_PERIOD');
  });
});
