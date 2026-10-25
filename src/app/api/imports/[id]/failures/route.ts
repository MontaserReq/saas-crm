import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { DataImportService } from '@/server/services/DataImportService';
import { safeCsvCell } from '@/lib/imports/smartImport';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(user, PERMISSIONS.SCHOOLS_IMPORT)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  try {
    const job = await DataImportService.getOwned(user, (await params).id);
    const failures = Array.isArray(job.failureRows) ? job.failureRows as Array<{ row?: unknown; reasons?: unknown }> : [];
    const csv = ['Row,Reasons', ...failures.map((failure) => `${safeCsvCell(failure.row)},${safeCsvCell(Array.isArray(failure.reasons) ? failure.reasons.join('; ') : '')}`)].join('\r\n');
    return new NextResponse(`\uFEFF${csv}`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="import-${job.id}-failures.csv"`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to download the failure report' }, { status: 404 });
  }
}
