import { describe, it, expect } from 'vitest';
import { deriveStatus, ONLINE_THRESHOLD_MS, AWAY_THRESHOLD_MS } from '@/lib/presence/deriveStatus';

describe('deriveStatus — pure presence status logic', () => {
  const now = new Date('2026-01-01T12:00:00.000Z');

  it('returns "offline" when there is no last-seen timestamp at all (never a fake "online")', () => {
    expect(deriveStatus(null, now)).toBe('offline');
    expect(deriveStatus(undefined, now)).toBe('offline');
  });

  it('returns "online" for a very recent heartbeat', () => {
    const lastSeen = new Date(now.getTime() - 5_000);
    expect(deriveStatus(lastSeen, now)).toBe('online');
  });

  it('returns "online" right up to the online threshold (tolerates one missed heartbeat tick)', () => {
    const lastSeen = new Date(now.getTime() - ONLINE_THRESHOLD_MS);
    expect(deriveStatus(lastSeen, now)).toBe('online');
  });

  it('returns "away" just past the online threshold', () => {
    const lastSeen = new Date(now.getTime() - ONLINE_THRESHOLD_MS - 1_000);
    expect(deriveStatus(lastSeen, now)).toBe('away');
  });

  it('returns "away" right up to the away threshold', () => {
    const lastSeen = new Date(now.getTime() - AWAY_THRESHOLD_MS);
    expect(deriveStatus(lastSeen, now)).toBe('away');
  });

  it('returns "offline" once the last heartbeat is older than the away threshold (a closed tab self-corrects, never stuck "online" forever)', () => {
    const lastSeen = new Date(now.getTime() - AWAY_THRESHOLD_MS - 1_000);
    expect(deriveStatus(lastSeen, now)).toBe('offline');

    const longGone = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(deriveStatus(longGone, now)).toBe('offline');
  });

  it('treats a slightly-in-the-future timestamp as online (clock skew guard) rather than crashing or misreporting', () => {
    const future = new Date(now.getTime() + 2_000);
    expect(deriveStatus(future, now)).toBe('online');
  });

  it('accepts both Date objects and ISO strings identically', () => {
    const iso = new Date(now.getTime() - 1_000).toISOString();
    expect(deriveStatus(iso, now)).toBe(deriveStatus(new Date(now.getTime() - 1_000), now));
  });
});
