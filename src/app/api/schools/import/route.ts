import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { SchoolService } from '@/server/services/SchoolService';
import { requireOrganizationId } from '@/lib/auth/organization';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedMimeTypes = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
  'application/octet-stream',
]);

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: { code: 'IMPORT_VALIDATION_FAILED', message } }, { status });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return errorResponse('Unauthorized', 401);
    if (!hasPermission(user, PERMISSIONS.SCHOOLS_IMPORT)) return errorResponse('Forbidden: Insufficient permissions to import schools', 403);

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return errorResponse('Please select an Excel file');
    if (file.size === 0) return errorResponse('Please select an Excel file');
    if (file.size > MAX_FILE_SIZE) return errorResponse('The maximum allowed file size is 10 MB');

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !['xlsx', 'xls', 'csv'].includes(extension)) return errorResponse('Unsupported file type. Use .xlsx, .xls, or .csv.');
    if (file.type && !allowedMimeTypes.has(file.type)) return errorResponse('Unsupported file content type.');

    const buffer = Buffer.from(await file.arrayBuffer());
    if (extension === 'xlsx' && (buffer.length < 4 || buffer.subarray(0, 2).toString() !== 'PK')) return errorResponse('Invalid XLSX file signature');
    if (extension === 'xls' && (buffer.length < 8 || buffer.readUInt32LE(0) !== 0xE011CFD0)) return errorResponse('Invalid XLS file signature');

    const workbook = XLSX.read(buffer, { type: 'buffer', WTF: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return errorResponse('The workbook has no worksheet');
    // Read the worksheet as a matrix first so every field remains tied to its
    // actual header index. Blank/ignored columns can never shift another field.
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true });
    const headerRow = matrix[0];
    if (!Array.isArray(headerRow) || headerRow.length === 0) return errorResponse('The worksheet has no header row');
    const headers = headerRow.map((header, index) => {
      const label = String(header ?? '').trim();
      return label || `__EMPTY_${index + 1}`;
    });
    const rows = matrix.slice(1)
      .filter((row) => Array.isArray(row) && row.some((value) => value !== '' && value !== null && value !== undefined))
      .map((row) => Object.fromEntries(headers.map((header, index) => [header, Array.isArray(row) ? row[index] ?? '' : ''])));
    const preview = await SchoolService.validateImportRows(rows, requireOrganizationId(user));
    return NextResponse.json({ success: true, fileName: file.name, ...preview });
  } catch (error) {
    console.error('School import preview error:', error);
    return errorResponse('Unable to validate the import file.');
  }
}
