import prisma from '@/lib/db/prisma';
import { deriveStatus, PresenceStatus } from '@/lib/presence/deriveStatus';

export type { PresenceStatus };

export class PresenceService {
  /**
   * Records that the given user is active right now. Always called with the
   * caller's own session id (see heartbeatAction) — never accepts/trusts a
   * client-supplied user id.
   */
  static async heartbeat(userId: string): Promise<void> {
    await prisma.userPresence.upsert({
      where: { userId },
      create: { userId, lastSeenAt: new Date() },
      update: { lastSeenAt: new Date() },
    });
  }

  /** Batch-fetches last-seen timestamps for a set of users (avoids N+1). */
  static async getLastSeenMap(userIds: string[]): Promise<Record<string, string>> {
    if (userIds.length === 0) return {};
    const rows = await prisma.userPresence.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, lastSeenAt: true },
    });
    const map: Record<string, string> = {};
    for (const row of rows) map[row.userId] = row.lastSeenAt.toISOString();
    return map;
  }

  /** Derives a display status from a last-seen timestamp. Never stored — always computed at read time so a closed tab self-corrects to "offline". */
  static deriveStatus(lastSeenAt: string | Date | null | undefined, now?: Date): PresenceStatus {
    return deriveStatus(lastSeenAt, now);
  }
}
