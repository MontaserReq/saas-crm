import { NextResponse } from 'next/server';
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
    if (!body || !Array.isArray(body.mappings) || typeof body.destination !== 'string' || typeof body.mode !== 'string') throw new Error('Invalid preview request');
    const result = await DataImportService.buildPreview(user, (await params).id, body, hasPermission(user, PERMISSIONS.CUSTOM_FIELDS_CREATE));
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to preview the import' }, { status: 400 });
  }
}
