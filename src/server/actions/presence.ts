'use server';

import { requireAuth } from '@/lib/auth/session';
import { PresenceService } from '@/server/services/PresenceService';

/**
 * Records that the current user is active right now. Intentionally takes no
 * arguments — the user id always comes from the authenticated session, so
 * there is no way to report presence on behalf of anyone else.
 */
export async function heartbeatAction(): Promise<{ success: boolean }> {
  try {
    const user = await requireAuth();
    await PresenceService.heartbeat(user.id);
    return { success: true };
  } catch {
    return { success: false };
  }
}
