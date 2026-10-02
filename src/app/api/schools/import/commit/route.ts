import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { SchoolService } from '@/server/services/SchoolService';
import { rejectUntrustedMutation } from '@/lib/security/web';
import { acquireOperation, finishOperation, RESOURCE_LIMITS } from '@/lib/security/resourceGuard';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const originError = rejectUntrustedMutation(request);
    if (originError) return originError;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    if (!hasPermission(user, PERMISSIONS.SCHOOLS_IMPORT)) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden: Insufficient permissions to import schools' } }, { status: 403 });

    const body = await request.json();
    if (!body || !Array.isArray(body.rows) || typeof body.operationId !== 'string' || body.operationId.length < 8 || body.operationId.length > 128) return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid import payload' } }, { status: 400 });
    if (!user.organizationId) return NextResponse.json({ success: false, error: { code: 'ORGANIZATION_REQUIRED', message: 'Organization context required' } }, { status: 403 });
    const execution = await acquireOperation({ organizationId: user.organizationId, userId: user.id, operationType: 'SCHOOL_IMPORT', idempotencyKey: body.operationId, limits: RESOURCE_LIMITS.SCHOOL_IMPORT });
    if (!execution.acquired || !execution.execution) {
      if (execution.reason === 'COMPLETED' && execution.execution?.resultPayload) return NextResponse.json({ success: true, ...JSON.parse(execution.execution.resultPayload), replayed: true });
      return NextResponse.json({ success: false, error: { code: 'IMPORT_BUSY', message: 'Another school import is already active. Please try again shortly.' } }, { status: 409 });
    }
    const ownerToken = execution.execution.ownerToken!;
    try {
      const result = await SchoolService.executeBulkImport(body.rows, user.id, body.metadata);
      await finishOperation(execution.execution.id, ownerToken, 'SUCCEEDED', { resultPayload: JSON.stringify({ importedCount: result.importedCount, ticketsCreated: result.ticketsCreated }) });
      revalidatePath('/schools');
      revalidatePath('/tickets');
      revalidatePath('/');
      return NextResponse.json({ success: true, importedCount: result.importedCount, ticketsCreated: result.ticketsCreated });
    } catch (error) {
      await finishOperation(execution.execution.id, ownerToken, 'FAILED', { failureReason: error instanceof Error ? error.message : 'Import failed' });
      throw error;
    }
  } catch (error) {
    console.error('School import commit error:', error);
    return NextResponse.json({ success: false, error: { code: 'IMPORT_FAILED', message: 'Unable to complete the bulk import.' } }, { status: 400 });
  }
}
