// Pure, framework-agnostic presence logic — no server-only imports (no
// Prisma), so this same function can run both server-side (PresenceService)
// and client-side (ChatWidget, to color a presence dot) without pulling a
// database client into the browser bundle.
export type PresenceStatus = 'online' | 'away' | 'offline';

// A heartbeat is sent roughly every 30s, so a gap under ~45s still counts as
// online (tolerates one missed tick, e.g. a slow request). Anything older
// than 5 minutes is treated as fully offline rather than "away" forever.
export const ONLINE_THRESHOLD_MS = 45_000;
export const AWAY_THRESHOLD_MS = 5 * 60_000;

export function deriveStatus(lastSeenAt: string | Date | null | undefined, now: Date = new Date()): PresenceStatus {
  if (!lastSeenAt) return 'offline';
  const ts = typeof lastSeenAt === 'string' ? new Date(lastSeenAt) : lastSeenAt;
  const ageMs = now.getTime() - ts.getTime();
  if (ageMs < 0) return 'online'; // clock skew guard — treat future timestamps as fresh
  if (ageMs <= ONLINE_THRESHOLD_MS) return 'online';
  if (ageMs <= AWAY_THRESHOLD_MS) return 'away';
  return 'offline';
}
