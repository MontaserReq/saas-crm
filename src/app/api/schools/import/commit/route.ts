import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { SchoolService } from '@/server/services/SchoolService';
import { rejectUntrustedMutation } from '@/lib/security/web';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const originError = rejectUntrustedMutation(request);
    if (originError) return originError;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    if (!hasPermission(user, PERMISSIONS.SCHOOLS_IMPORT)) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden: Insufficient permissions to import schools' } }, { status: 403 });

    const body = await request.json();
    if (!body || !Array.isArray(body.rows)) return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid import payload' } }, { status: 400 });
    const result = await SchoolService.executeBulkImport(body.rows, user.id, body.metadata);
    revalidatePath('/schools');
    revalidatePath('/tickets');
    revalidatePath('/');
    return NextResponse.json({ success: true, importedCount: result.importedCount, ticketsCreated: result.ticketsCreated });
  } catch (error) {
    console.error('School import commit error:', error);
    return NextResponse.json({ success: false, error: { code: 'IMPORT_FAILED', message: 'Unable to complete the bulk import.' } }, { status: 400 });
  }
}
