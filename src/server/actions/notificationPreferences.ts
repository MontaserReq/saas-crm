'use server';

import { requireAuth } from '@/lib/auth/session';
import { requireOrganizationId } from '@/lib/auth/organization';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import prisma from '@/lib/db/prisma';

export const NOTIFICATION_EMAIL_CATEGORIES = ['TICKET_ASSIGNED', 'TICKET_TRANSFERRED', 'NEW_MESSAGE', 'MENTION', 'WORKFLOW', 'SCHOOL_APPROVAL_REQUESTED'] as const;

export async function updateNotificationPreferencesAction(input: { inAppEnabled: boolean; emailEnabled: boolean; categories: Record<string, boolean> }) {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.NOTIFICATION_PREFERENCES_MANAGE)) return { success: false as const, error: 'Forbidden' };
    const organizationId = requireOrganizationId(user);
    const categories = Object.fromEntries(NOTIFICATION_EMAIL_CATEGORIES.map((key) => [key, input.categories[key] !== false]));
    await prisma.userNotificationPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, organizationId, inAppEnabled: Boolean(input.inAppEnabled), emailEnabled: Boolean(input.emailEnabled), categories: JSON.stringify(categories) },
      update: { organizationId, inAppEnabled: Boolean(input.inAppEnabled), emailEnabled: Boolean(input.emailEnabled), categories: JSON.stringify(categories) },
    });
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Unable to save notification preferences' };
  }
}
