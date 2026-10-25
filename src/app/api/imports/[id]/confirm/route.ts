import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { rejectUntrustedMutation } from '@/lib/security/web';
import { DataImportService } from '@/server/services/DataImportService';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(user, PERMISSIONS.SCHOOLS_IMPORT)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  try {
    const body = await request.json();
    const result = await DataImportService.confirm(user, (await params).id, String(body?.idempotencyKey || ''), hasPermission(user, PERMISSIONS.CUSTOM_FIELDS_CREATE));
    for (const path of ['/imports', '/clients', '/leads', '/contacts', '/deals', '/tasks']) revalidatePath(path);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to complete the import' }, { status: 400 });
  }
}
