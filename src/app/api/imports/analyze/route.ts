import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { requireOrganizationId } from '@/lib/auth/organization';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { parseBoundedMultipart, uploadErrorResponse } from '@/lib/security/multipart';
import { rejectUntrustedMutation } from '@/lib/security/web';
import { parseSpreadsheet, resolveSmartImportLimits } from '@/lib/imports/parseSpreadsheet';
import { detectDestination, IMPORT_DESTINATIONS, IMPORT_FIELDS, ImportDestination, suggestColumns } from '@/lib/imports/smartImport';
import { DataImportService } from '@/server/services/DataImportService';

export const runtime = 'nodejs';
function responseError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const originError = rejectUntrustedMutation(request);
    if (originError) return originError;
    const user = await getCurrentUser();
    if (!user) return responseError('Unauthorized', 401);
    if (!hasPermission(user, PERMISSIONS.SCHOOLS_IMPORT)) return responseError('You do not have permission to import CRM data', 403);
    const importLimits = resolveSmartImportLimits(user.planSlug);
    const uploadLimits = { requestBytes: importLimits.maxFileBytes + 256 * 1024, fileBytes: importLimits.maxFileBytes, totalFileBytes: importLimits.maxFileBytes };
    const parts = await parseBoundedMultipart(request, uploadLimits);
    const file = parts.find((part) => part.name === 'file' && part.filename !== undefined);
    if (!file?.filename) return responseError('Select an Excel or CSV file');
    const textPart = (name: string) => parts.find((part) => part.name === name && part.filename === undefined)?.data.toString('utf8').trim() || null;
    const requestedDestination = textPart('destination');
    if (requestedDestination && !IMPORT_DESTINATIONS.includes(requestedDestination as ImportDestination)) return responseError('Unsupported destination module');
    const parsed = await parseSpreadsheet({ buffer: file.data, filename: file.filename, mimeType: file.contentType, sheetName: textPart('sheetName'), limits: importLimits });
    const detection = detectDestination(parsed.headers);
    const destination = requestedDestination as ImportDestination | null;
    const draft = await DataImportService.createDraft(user, { filename: file.filename.split(/[\\/]/).pop() || 'import', sheetName: parsed.selectedSheet, headers: parsed.headers, rows: parsed.rows, destination, recommendedDestination: detection.destination });
    const organizationId = requireOrganizationId(user);
    const definitions = await prisma.customFieldDefinition.findMany({ where: { organizationId, entityType: { in: [...IMPORT_DESTINATIONS] }, archivedAt: null, active: true }, select: { key: true, label: true, fieldType: true, required: true, searchable: true, entityType: true, options: true }, orderBy: [{ entityType: 'asc' }, { displayOrder: 'asc' }] });
    const customFields = Object.fromEntries(IMPORT_DESTINATIONS.map((entity) => [entity, definitions.filter((definition) => definition.entityType === entity)]));
    const suggestions = Object.fromEntries(IMPORT_DESTINATIONS.map((entity) => [entity, suggestColumns(parsed.headers, parsed.rows, entity)]));
    return NextResponse.json({
      success: true,
      importId: draft.id,
      filename: draft.originalFilename,
      sheetNames: parsed.sheetNames,
      selectedSheet: parsed.selectedSheet,
      rowCount: parsed.rows.length,
      headers: parsed.headers,
      detection,
      destination,
      fields: IMPORT_FIELDS,
      customFields,
      suggestions,
      limits: { maxRows: importLimits.maxRows, maxFileBytes: importLimits.maxFileBytes, maxColumns: importLimits.maxColumns, maxCells: importLimits.maxCells },
      canCreateCustomFields: hasPermission(user, PERMISSIONS.CUSTOM_FIELDS_CREATE),
    });
  } catch (error) {
    const uploadError = uploadErrorResponse(error);
    if (uploadError) return uploadError;
    return responseError(error instanceof Error ? error.message : 'Unable to analyze the spreadsheet');
  }
}
