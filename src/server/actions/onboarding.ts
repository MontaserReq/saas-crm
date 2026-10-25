'use server';

import { requireAuth } from '@/lib/auth/session';
import { OnboardingService } from '@/server/services/OnboardingService';
import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';

function failure(error: unknown) {
  return { success: false as const, error: error instanceof ZodError ? 'SETUP_INVALID' : error instanceof Error && error.message === 'Forbidden' ? 'FORBIDDEN' : 'SETUP_RETRY' };
}
export async function saveOnboardingAction(input: unknown) {
  try { return { success: true as const, state: await OnboardingService.save(await requireAuth(), input) }; } catch (error) { return failure(error); }
}
export async function completeOnboardingAction(input: unknown) {
  try {
    const state = await OnboardingService.complete(await requireAuth(), input);
    revalidatePath('/', 'layout');
    return { success: true as const, state };
  } catch (error) { return failure(error); }
}
export async function onboardingEventAction(event: unknown) {
  try { await OnboardingService.event(await requireAuth(), event); return { success: true }; } catch { return { success: false }; }
}
export async function updateOnboardingChecklistAction(input: unknown) {
  try {
    const state = await OnboardingService.checklist(await requireAuth(), input);
    revalidatePath('/dashboard');
    return { success: true as const, state };
  } catch (error) { return failure(error); }
}
