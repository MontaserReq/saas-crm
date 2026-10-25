'use server';

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/session';
import { platformResources } from '@/lib/platform/types';
import { assertPlatformResourceMutationAllowed } from '@/lib/platform/access';
import { PlatformAdminService } from '@/server/services/PlatformAdminService';

function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message || 'Invalid form';
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return 'A record with these details already exists';
    if (error.code === 'P2003') return 'This record is linked to other data. Remove those links first or deactivate it';
    if (error.code === 'P2025') return 'Record not found. Refresh this page';
    if (error.code === 'P2034') return 'The record changed while saving. Please try again';
    return 'Unable to save this record';
  }
  return error instanceof Error && !error.message.includes('prisma') ? error.message : 'Unable to save this record';
}
function refresh() { revalidatePath('/admin', 'layout'); revalidatePath('/admin/platform', 'layout'); revalidatePath('/pricing'); revalidatePath('/'); }

export async function savePlatformRecordAction(resource: string, id: string | null, input: unknown) {
  try {
    const user = await requireAuth();
    const parsedResource = z.enum(platformResources).parse(resource);
    const parsedId = z.string().min(1).max(100).nullable().parse(id);
    assertPlatformResourceMutationAllowed(parsedResource, parsedId ? 'update' : 'create');
    const recordId = await PlatformAdminService.save(user, parsedResource, parsedId, input);
    refresh(); return { success: true as const, id: recordId };
  } catch (error) { return { success: false as const, error: errorMessage(error) }; }
}
export async function deletePlatformRecordAction(resource: string, id: string) {
  try {
    const user = await requireAuth();
    const parsedResource = z.enum(platformResources).parse(resource);
    assertPlatformResourceMutationAllowed(parsedResource, 'delete');
    await PlatformAdminService.remove(user, parsedResource, z.string().min(1).max(100).parse(id));
    refresh(); return { success: true as const };
  } catch (error) { return { success: false as const, error: errorMessage(error) }; }
}
