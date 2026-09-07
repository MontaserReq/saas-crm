'use server';

import { requireAuth } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { AssignmentService, BulkAssignmentInput } from '@/server/services/AssignmentService';
import { revalidatePath } from 'next/cache';

export async function executeBulkAssignmentAction(input: BulkAssignmentInput) {
  try {
    const user = await requireAuth();
    if (!hasPermission(user, PERMISSIONS.SCHOOLS_ASSIGN)) {
      return { success: false, error: 'Forbidden: Insufficient permissions to assign schools' };
    }

    const result = await AssignmentService.executeBulkAssignment(input, user.id);
    revalidatePath('/assignments');
    revalidatePath('/tickets');
    revalidatePath('/schools');
    revalidatePath('/');
    return { success: true, ticketsCount: result.ticketsCount, batchNumber: result.batch.batchNumber };
  } catch (err: any) {
    return { success: false, error: err.message || 'Bulk assignment failed' };
  }
}
