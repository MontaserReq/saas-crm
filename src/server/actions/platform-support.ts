'use server';

import { requireAuth } from '@/lib/auth/session';
import { PlatformSupportService } from '@/server/services/PlatformSupportService';
import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';

export async function createPlatformSupportRequestAction(input: unknown) {
  try {
    await PlatformSupportService.create(await requireAuth(), input);
    revalidatePath('/support');
    revalidatePath('/admin/platform/support');
    revalidatePath('/admin', 'layout');
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof ZodError ? 'INVALID_INPUT' : 'RETRY',
    };
  }
}
