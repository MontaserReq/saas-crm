import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { SchoolService } from '@/server/services/SchoolService';
import { requireOrganizationId } from '@/lib/auth/organization';
import { rejectUntrustedMutation } from '@/lib/security/web';
import { parseBoundedMultipart, uploadErrorResponse, UPLOAD_LIMITS } from '@/lib/security/multipart';
import { parseSpreadsheet, SMART_IMPORT_LIMITS } from '@/lib/imports/parseSpreadsheet';

export const runtime = 'nodejs';

const allowedMimeTypes = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/csv',
  'application/octet-stream',
]);

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: { code: 'IMPORT_VALIDATION_FAILED', message } }, { status });
}

export async function POST(request: Request) {
  try {
    const originError = rejectUntrustedMutation(request);
    if (originError) return originError;
    const user = await getCurrentUser();
    if (!user) return errorResponse('Unauthorized', 401);
    if (!hasPermission(user, PERMISSIONS.SCHOOLS_IMPORT)) return errorResponse('Forbidden: Insufficient permissions to import schools', 403);

    const parts = await parseBoundedMultipart(request, UPLOAD_LIMITS.import);
    const filePart = parts.find((part) => part.name === 'file' && part.filename !== undefined);
    if (!filePart) return errorResponse('Please select an Excel file');
    if (filePart.data.length === 0) return errorResponse('Please select an Excel file');
    if (filePart.data.length > SMART_IMPORT_LIMITS.maxFileBytes) return errorResponse(`The maximum allowed file size is ${Math.floor(SMART_IMPORT_LIMITS.maxFileBytes / 1024 / 1024)} MB`);

    const extension = filePart.filename?.split('.').pop()?.toLowerCase();
    if (!extension || !['xlsx', 'csv'].includes(extension)) return errorResponse('Unsupported file type. Use .xlsx or .csv. Legacy .xls files must be saved as .xlsx or .csv.');
    if (filePart.contentType && filePart.contentType !== 'application/octet-stream' && !allowedMimeTypes.has(filePart.contentType)) return errorResponse('Unsupported file content type.');

    const parsed = await parseSpreadsheet({ buffer: filePart.data, filename: filePart.filename || 'upload', mimeType: filePart.contentType });
    const preview = await SchoolService.validateImportRows(parsed.rows, requireOrganizationId(user));
    return NextResponse.json({ success: true, fileName: filePart.filename, ...preview });
  } catch (error) {
    const resourceError = uploadErrorResponse(error);
    if (resourceError) return resourceError;
    console.error('School import preview failed');
    return errorResponse('Unable to validate the import file.');
  }
}
