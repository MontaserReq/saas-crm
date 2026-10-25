import { Prisma } from '@prisma/client';
import prisma from '@/lib/db/prisma';
import { UserSession } from '@/types';
import { requireOrganizationContext } from '@/lib/auth/organization';
import {
  ColumnMapping,
  IMPORT_DESTINATIONS,
  IMPORT_FIELDS,
  ImportDestination,
  ImportMode,
  normalizeHeader,
  parseTypedValue,
  slugifyFieldKey,
} from '@/lib/imports/smartImport';
import { SMART_IMPORT_LIMITS } from '@/lib/imports/parseSpreadsheet';

type SourceRow = Record<string, string | number | boolean | null>;
type FailureRow = { row: number; reasons: string[] };
type PreviewRow = { row: number; values: Record<string, unknown>; issues: string[]; duplicate: boolean; action: 'CREATE' | 'UPDATE' | 'SKIP' | 'REJECT'; matchId?: string };

const modes = new Set<ImportMode>(['CREATE', 'SKIP_DUPLICATES', 'UPDATE', 'UPSERT']);
const destinations = new Set<string>(IMPORT_DESTINATIONS);
const customTypes = new Set(['TEXT', 'TEXTAREA', 'NUMBER', 'CURRENCY', 'BOOLEAN', 'DATE', 'DATETIME', 'EMAIL', 'PHONE', 'URL', 'SELECT', 'MULTI_SELECT']);
const reliableMatchFields: Record<ImportDestination, string[]> = { CLIENT: ['email', 'phone'], LEAD: ['email', 'phone'], CONTACT: ['email', 'phone', 'mobile'], DEAL: [], TASK: [] };

function asRows(value: Prisma.JsonValue | null): SourceRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is Prisma.JsonObject => !!row && typeof row === 'object' && !Array.isArray(row)) as SourceRow[];
}
function asMappings(value: Prisma.JsonValue | null): ColumnMapping[] {
  return Array.isArray(value) ? value as unknown as ColumnMapping[] : [];
}
function normIdentity(value: unknown, field: string) {
  const text = String(value ?? '').trim().toLowerCase();
  if (field === 'phone' || field === 'mobile') return text.replace(/[^\d+]/g, '');
  return text;
}
function safeMessage(error: unknown) {
  if (!(error instanceof Error)) return 'The import could not be completed';
  if (/unique constraint/i.test(error.message)) return 'A unique value conflicts with an existing record';
  if (/foreign key/i.test(error.message)) return 'A related record is missing or no longer available';
  return ['Import configuration is invalid', 'The import draft has expired', 'The import could not be claimed'].some((message) => error.message.startsWith(message)) ? error.message : 'The import could not be completed';
}

export class DataImportService {
  private static async purgeExpired(organizationId: string) {
    const now = new Date();
    await prisma.$transaction([
      prisma.dataImport.updateMany({ where: { organizationId, expiresAt: { lt: now }, status: { in: ['DRAFT', 'READY', 'FAILED'] } }, data: { status: 'CANCELLED', sourceRows: Prisma.DbNull, failureRows: Prisma.DbNull, errorMessage: 'Import draft expired' } }),
      prisma.dataImport.updateMany({ where: { organizationId, expiresAt: { lt: now }, status: { in: ['COMPLETED', 'PARTIAL', 'CANCELLED'] } }, data: { sourceRows: Prisma.DbNull, failureRows: Prisma.DbNull } }),
    ]).catch(() => undefined);
  }

  static async createDraft(user: UserSession, input: { filename: string; sheetName: string; headers: string[]; rows: SourceRow[]; destination?: ImportDestination | null; recommendedDestination?: ImportDestination | null }) {
    const organizationId = (await requireOrganizationContext(user)).id;
    await this.purgeExpired(organizationId);
    return prisma.dataImport.create({
      data: {
        organizationId,
        initiatedById: user.id,
        originalFilename: input.filename.slice(0, 255),
        sheetName: input.sheetName.slice(0, 255),
        destination: input.destination || null,
        recommendedDestination: input.recommendedDestination || null,
        headers: input.headers,
        sourceRows: input.rows as Prisma.InputJsonValue,
        totalRows: input.rows.length,
        expiresAt: new Date(Date.now() + SMART_IMPORT_LIMITS.draftRetentionHours * 60 * 60 * 1000),
      },
    });
  }

  static async listHistory(user: UserSession, take = 30) {
    const organizationId = (await requireOrganizationContext(user)).id;
    await this.purgeExpired(organizationId);
    return prisma.dataImport.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(take, 1), 100),
      select: { id: true, destination: true, originalFilename: true, sheetName: true, status: true, mode: true, totalRows: true, processedRows: true, importedRows: true, updatedRows: true, skippedRows: true, failedRows: true, createdAt: true, completedAt: true, initiatedBy: { select: { name: true } } },
    });
  }

  static async getOwned(user: UserSession, id: string) {
    const organizationId = (await requireOrganizationContext(user)).id;
    const job = await prisma.dataImport.findFirst({ where: { id, organizationId } });
    if (!job) throw new Error('Import not found');
    return job;
  }

  private static validateConfiguration(job: Awaited<ReturnType<typeof DataImportService.getOwned>>, input: { destination: string; mappings: ColumnMapping[]; mode: string; matchField?: string | null }, canCreateCustomFields: boolean) {
    if (!destinations.has(input.destination)) throw new Error('Import configuration is invalid: unsupported destination');
    const destination = input.destination as ImportDestination;
    if (!modes.has(input.mode as ImportMode)) throw new Error('Import configuration is invalid: unsupported mode');
    const headers = new Set((job.headers as string[]) || []);
    const fields = new Map(IMPORT_FIELDS[destination].map((field) => [field.key, field]));
    const usedTargets = new Set<string>();
    const mappings: ColumnMapping[] = [];
    for (const raw of input.mappings) {
      if (!raw || typeof raw.source !== 'string' || !headers.has(raw.source) || !['FIELD', 'CUSTOM', 'IGNORE'].includes(raw.action)) throw new Error('Import configuration is invalid: invalid column mapping');
      const mapping = { ...raw };
      if (mapping.action === 'FIELD') {
        if (!mapping.target || !fields.has(mapping.target) || usedTargets.has(mapping.target)) throw new Error('Import configuration is invalid: duplicate or unknown destination field');
        usedTargets.add(mapping.target);
      }
      if (mapping.action === 'CUSTOM') {
        if (!mapping.target && !canCreateCustomFields) throw new Error('Import configuration is invalid: custom-field permission is required');
        if (mapping.customType && !customTypes.has(mapping.customType)) throw new Error('Import configuration is invalid: unsupported custom field type');
        if (!mapping.target && !mapping.customLabel?.trim()) throw new Error('Import configuration is invalid: custom field name is required');
        if (!mapping.target && ['SELECT', 'MULTI_SELECT'].includes(mapping.customType || '') && (!Array.isArray(mapping.customOptions) || !mapping.customOptions.length || new Set(mapping.customOptions.map((option) => option.trim()).filter(Boolean)).size !== mapping.customOptions.length)) throw new Error('Import configuration is invalid: select custom fields require unique options');
      }
      mappings.push(mapping);
    }
    for (const field of fields.values()) if (field.required && !usedTargets.has(field.key)) throw new Error(`Import configuration is invalid: map required field ${field.label}`);
    const mode = input.mode as ImportMode;
    const matchField = input.matchField || null;
    if (mode !== 'CREATE' && (!matchField || !reliableMatchFields[destination].includes(matchField) || !usedTargets.has(matchField))) throw new Error('Import configuration is invalid: select a reliable mapped match field for duplicate handling');
    return { destination, mappings, mode, matchField, fields };
  }

  private static async relationResolvers(organizationId: string, rows: SourceRow[], mappings: ColumnMapping[]) {
    const relationTargets = new Map(mappings.filter((mapping) => mapping.action === 'FIELD' && mapping.target?.endsWith('Id')).map((mapping) => [mapping.target!, mapping.source]));
    const values = (key: string) => [...new Set(rows.map((row) => String(row[relationTargets.get(key) || ''] ?? '').trim()).filter(Boolean))];
    const entries = new Map<string, Map<string, string | null>>();
    const register = (key: string, records: Array<{ id: string; aliases: Array<string | null | undefined> }>) => {
      const grouped = new Map<string, string[]>();
      for (const record of records) for (const alias of [record.id, ...record.aliases]) {
        if (!alias?.trim()) continue;
        const normalized = normalizeHeader(alias);
        grouped.set(normalized, [...new Set([...(grouped.get(normalized) || []), record.id])]);
      }
      entries.set(key, new Map([...grouped].map(([alias, ids]) => [alias, ids.length === 1 ? ids[0] : null])));
    };
    const tasks: Promise<unknown>[] = [];
    for (const key of relationTargets.keys()) {
      const candidates = values(key);
      if (!candidates.length) continue;
      if (key === 'clientId') tasks.push(prisma.client.findMany({ where: { organizationId, deletedAt: null, OR: [{ id: { in: candidates } }, { name: { in: candidates, mode: 'insensitive' } }] }, select: { id: true, name: true } }).then((records) => register(key, records.map((record) => ({ id: record.id, aliases: [record.name] })))));
      else if (key === 'primaryContactId' || key === 'contactId') tasks.push(prisma.contact.findMany({ where: { organizationId, deletedAt: null, OR: [{ id: { in: candidates } }, { email: { in: candidates, mode: 'insensitive' } }, { firstName: { in: candidates, mode: 'insensitive' } }] }, select: { id: true, email: true, firstName: true, lastName: true } }).then((records) => register(key, records.map((record) => ({ id: record.id, aliases: [record.email, record.firstName, `${record.firstName} ${record.lastName || ''}`.trim()] })))));
      else if (key === 'leadId') tasks.push(prisma.lead.findMany({ where: { organizationId, deletedAt: null, OR: [{ id: { in: candidates } }, { name: { in: candidates, mode: 'insensitive' } }, { email: { in: candidates, mode: 'insensitive' } }] }, select: { id: true, name: true, email: true } }).then((records) => register(key, records.map((record) => ({ id: record.id, aliases: [record.name, record.email] })))));
      else if (key === 'dealId') tasks.push(prisma.deal.findMany({ where: { organizationId, deletedAt: null, OR: [{ id: { in: candidates } }, { title: { in: candidates, mode: 'insensitive' } }] }, select: { id: true, title: true } }).then((records) => register(key, records.map((record) => ({ id: record.id, aliases: [record.title] })))));
      else if (key === 'pipelineId') tasks.push(prisma.pipeline.findMany({ where: { organizationId, isActive: true, OR: [{ id: { in: candidates } }, { name: { in: candidates, mode: 'insensitive' } }] }, select: { id: true, name: true } }).then((records) => register(key, records.map((record) => ({ id: record.id, aliases: [record.name] })))));
      else if (key === 'stageId') tasks.push((async () => {
        const stages = await prisma.pipelineStage.findMany({ where: { organizationId, isActive: true, OR: [{ id: { in: candidates } }, { name: { in: candidates, mode: 'insensitive' } }] }, select: { id: true, name: true, pipelineId: true } });
        register(key, stages.map((stage) => ({ id: stage.id, aliases: [stage.name] })));
        entries.set('stageByPipeline', new Map(stages.flatMap((stage) => [[`${stage.pipelineId}:${normalizeHeader(stage.id)}`, stage.id], [`${stage.pipelineId}:${normalizeHeader(stage.name)}`, stage.id]])));
      })());
      else if (key === 'ownerId' || key === 'assignedUserId') tasks.push(prisma.organizationMember.findMany({ where: { organizationId, status: 'ACTIVE', user: { OR: [{ id: { in: candidates } }, { email: { in: candidates, mode: 'insensitive' } }, { name: { in: candidates, mode: 'insensitive' } }] } }, select: { user: { select: { id: true, name: true, email: true } } } }).then((members) => register(key, members.map(({ user }) => ({ id: user.id, aliases: [user.name, user.email] })))));
    }
    await Promise.all(tasks);
    return entries;
  }

  private static async existingMatches(organizationId: string, destination: ImportDestination, matchField: string | null, rows: PreviewRow[]): Promise<Map<string, string | null>> {
    if (!matchField) return new Map<string, string | null>();
    const values = [...new Set(rows.map((row) => row.values[matchField]).filter(Boolean).map((value) => String(value).trim()))];
    if (!values.length) return new Map<string, string | null>();
    const model = destination === 'CLIENT' ? prisma.client : destination === 'LEAD' ? prisma.lead : prisma.contact;
    const records = await (model as any).findMany({ where: { organizationId, deletedAt: null, [matchField]: { in: values, mode: matchField === 'email' ? 'insensitive' : undefined } }, select: { id: true, [matchField]: true } });
    const grouped = new Map<string, string[]>();
    for (const record of records.filter((item: any) => item[matchField])) {
      const identity = normIdentity(record[matchField], matchField);
      grouped.set(identity, [...(grouped.get(identity) || []), String(record.id)]);
    }
    return new Map([...grouped].map(([identity, ids]) => [identity, ids.length === 1 ? ids[0] : null]));
  }

  static async buildPreview(user: UserSession, id: string, input: { destination: string; mappings: ColumnMapping[]; mode: string; matchField?: string | null }, canCreateCustomFields: boolean, persist = true, includeAllRows = false) {
    const organizationId = (await requireOrganizationContext(user)).id;
    const job = await this.getOwned(user, id);
    if (!job.sourceRows || job.expiresAt <= new Date()) throw new Error('The import draft has expired');
    if (['COMPLETED', 'CANCELLED'].includes(job.status)) throw new Error('Import configuration is invalid: this import is already closed');
    const { destination, mappings, mode, matchField, fields } = this.validateConfiguration(job, input, canCreateCustomFields);
    const rows = asRows(job.sourceRows);
    const existingDefinitions = await prisma.customFieldDefinition.findMany({ where: { organizationId, entityType: destination, archivedAt: null, active: true } });
    const definitionsByKey = new Map(existingDefinitions.map((field) => [field.key, field]));
    const mappedExistingCustomFields = new Set(mappings.filter((mapping) => mapping.action === 'CUSTOM' && mapping.target).map((mapping) => mapping.target));
    const unmappedRequiredCustomField = existingDefinitions.find((definition) => definition.required && !mappedExistingCustomFields.has(definition.key));
    if (unmappedRequiredCustomField) throw new Error(`Import configuration is invalid: map required custom field ${unmappedRequiredCustomField.label}`);
    const proposed = mappings.filter((mapping) => mapping.action === 'CUSTOM' && !mapping.target).map((mapping, index) => ({ source: mapping.source, key: slugifyFieldKey(mapping.customLabel || mapping.source, index + 1), label: (mapping.customLabel || mapping.source).trim(), fieldType: mapping.customType || 'TEXT', required: !!mapping.required, searchable: !!mapping.searchable, options: ['SELECT', 'MULTI_SELECT'].includes(mapping.customType || '') ? mapping.customOptions!.map((option) => option.trim()) : undefined }));
    const proposedKeys = new Set<string>();
    for (const field of proposed) {
      let key = field.key;
      let suffix = 2;
      while (definitionsByKey.has(key) || proposedKeys.has(key)) key = `${field.key.slice(0, 60)}_${suffix++}`;
      field.key = key;
      proposedKeys.add(key);
    }
    for (const mapping of mappings.filter((item) => item.action === 'CUSTOM' && item.target)) if (!definitionsByKey.has(mapping.target!)) throw new Error('Import configuration is invalid: unknown custom field');
    const relationResolvers = await this.relationResolvers(organizationId, rows, mappings);
    const seen = new Map<string, number>();
    const previewRows: PreviewRow[] = rows.map((sourceRow, index) => {
      const values: Record<string, unknown> = {};
      const issues: string[] = [];
      const pendingRelations: Array<{ key: string; label: string; value: unknown }> = [];
      for (const mapping of mappings) {
        if (mapping.action === 'IGNORE') continue;
        if (mapping.action === 'FIELD' && mapping.target) {
          const field = fields.get(mapping.target)!;
          const parsed = parseTypedValue(sourceRow[mapping.source], field);
          values[mapping.target] = parsed.value;
          if (parsed.error) issues.push(parsed.error);
          if (field.type === 'RELATION' && parsed.value) pendingRelations.push({ key: mapping.target, label: field.label, value: parsed.value });
        } else if (mapping.action === 'CUSTOM') {
          const definition = mapping.target ? definitionsByKey.get(mapping.target) : proposed.find((item) => item.source === mapping.source);
          const customKey = mapping.target || definition?.key;
          if (!customKey) continue;
          const type = (mapping.target ? (definition as typeof existingDefinitions[number]).fieldType : (definition as typeof proposed[number]).fieldType) as any;
          const label = mapping.target ? (definition as typeof existingDefinitions[number]).label : (definition as typeof proposed[number]).label;
          const rawOptions = mapping.target ? (definition as typeof existingDefinitions[number]).options : (definition as typeof proposed[number]).options;
          const options = Array.isArray(rawOptions) ? rawOptions.map(String) : undefined;
          const parsed = parseTypedValue(sourceRow[mapping.source], { key: customKey, label, labelAr: label, type, aliases: [], options, required: mapping.target ? (definition as typeof existingDefinitions[number]).required : !!mapping.required });
          values[`custom:${customKey}`] = parsed.value;
          if (parsed.error) issues.push(parsed.error);
        }
      }
      for (const relation of pendingRelations.filter((item) => item.key !== 'stageId')) {
        const resolver = relationResolvers.get(relation.key);
        const resolved = resolver?.get(normalizeHeader(relation.value));
        if (resolved === null) issues.push(`${relation.label} is ambiguous; use a unique ID or email`);
        else if (!resolved) issues.push(`${relation.label} does not reference a record in this organization`);
        else values[relation.key] = resolved;
      }
      for (const relation of pendingRelations.filter((item) => item.key === 'stageId')) {
        const scoped = values.pipelineId ? relationResolvers.get('stageByPipeline')?.get(`${values.pipelineId}:${normalizeHeader(relation.value)}`) : undefined;
        const resolved = scoped || relationResolvers.get('stageId')?.get(normalizeHeader(relation.value));
        if (resolved === null) issues.push(`${relation.label} is ambiguous; use a stage ID or a pipeline-specific stage name`);
        else if (!resolved) issues.push(`${relation.label} does not reference a stage in the mapped pipeline`);
        else values.stageId = resolved;
      }
      let duplicate = false;
      if (matchField && values[matchField]) {
        const identity = normIdentity(values[matchField], matchField);
        duplicate = seen.has(identity);
        if (duplicate) issues.push(`Duplicate ${matchField} within the uploaded file (first seen on row ${seen.get(identity)})`);
        else seen.set(identity, index + 2);
      }
      return { row: index + 2, values, issues, duplicate, action: issues.length ? 'REJECT' : 'CREATE' };
    });
    const matches = await this.existingMatches(organizationId, destination, matchField, previewRows);
    for (const row of previewRows) {
      if (row.action === 'REJECT') continue;
      const identity = matchField && row.values[matchField] ? normIdentity(row.values[matchField], matchField) : '';
      if (identity && matches.has(identity) && matches.get(identity) === null) {
        row.issues.push(`Multiple existing records share this ${matchField}; select a unique identity before importing`);
        row.action = 'REJECT';
        continue;
      }
      const matchId = identity ? String(matches.get(identity) ?? '') : '';
      if (matchId) row.matchId = matchId;
      if (mode === 'SKIP_DUPLICATES' && (matchId || row.duplicate)) row.action = 'SKIP';
      else if (mode === 'UPDATE') row.action = matchId ? 'UPDATE' : 'SKIP';
      else if (mode === 'UPSERT') row.action = matchId ? 'UPDATE' : 'CREATE';
    }
    const failures: FailureRow[] = previewRows.filter((row) => row.issues.length).map((row) => ({ row: row.row, reasons: row.issues }));
    const summary = {
      total: previewRows.length,
      create: previewRows.filter((row) => row.action === 'CREATE').length,
      update: previewRows.filter((row) => row.action === 'UPDATE').length,
      skip: previewRows.filter((row) => row.action === 'SKIP').length,
      reject: previewRows.filter((row) => row.action === 'REJECT').length,
      existingMatches: previewRows.filter((row) => !!row.matchId).length,
      duplicateRows: previewRows.filter((row) => row.duplicate).length,
      ignoredColumns: mappings.filter((mapping) => mapping.action === 'IGNORE').map((mapping) => mapping.source),
      proposedCustomFields: proposed,
    };
    if (persist) await prisma.dataImport.update({ where: { id: job.id }, data: { destination, mode, matchField, mapping: mappings as unknown as Prisma.InputJsonValue, proposedCustomFields: proposed as unknown as Prisma.InputJsonValue, status: 'READY', validRows: summary.create + summary.update, failedRows: summary.reject, skippedRows: summary.skip, failureRows: failures as unknown as Prisma.InputJsonValue, errorMessage: null } });
    return { summary, rows: includeAllRows ? previewRows : previewRows.slice(0, 100), fields: IMPORT_FIELDS[destination], existingCustomFields: existingDefinitions.map(({ id: _id, organizationId: _org, createdById: _created, updatedById: _updated, ...field }) => field) };
  }

  private static customValueData(fieldType: string, value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    if (fieldType === 'NUMBER' || fieldType === 'CURRENCY') return { valueNumber: Number(value) };
    if (fieldType === 'BOOLEAN') return { valueBoolean: Boolean(value) };
    if (fieldType === 'DATE' || fieldType === 'DATETIME') return { valueDate: new Date(String(value)) };
    if (fieldType === 'MULTI_SELECT') return { valueJson: value as Prisma.InputJsonValue };
    return { valueText: String(value) };
  }

  private static baseData(destination: ImportDestination, values: Record<string, unknown>, organizationId: string, user: UserSession, creating: boolean) {
    const base = Object.fromEntries(Object.entries(values).filter(([key]) => !key.startsWith('custom:')));
    if (destination === 'CLIENT') return { organizationId, name: base.name, type: base.type, status: base.status, description: base.description, category: base.category, website: base.website, email: base.email, phone: base.phone, address: base.address, ...(creating ? { createdById: user.id } : { updatedById: user.id }) };
    if (destination === 'LEAD') return { organizationId, name: base.name, companyName: base.companyName, email: base.email, phone: base.phone, source: base.source, status: base.status, notes: base.notes, clientId: base.clientId };
    if (destination === 'CONTACT') return { organizationId, firstName: base.firstName, lastName: base.lastName, jobTitle: base.jobTitle, email: base.email, phone: base.phone, mobile: base.mobile, isPrimary: base.isPrimary, notes: base.notes, clientId: base.clientId };
    if (destination === 'DEAL') return { organizationId, title: base.title, description: base.description, clientId: base.clientId, primaryContactId: base.primaryContactId, leadId: base.leadId, pipelineId: base.pipelineId, stageId: base.stageId, value: base.value, currency: base.currency, probability: base.probability, expectedCloseDate: base.expectedCloseDate ? new Date(String(base.expectedCloseDate)) : base.expectedCloseDate, ownerId: base.ownerId, ...(creating ? { createdById: user.id } : {}) };
    return { organizationId, title: base.title, description: base.description, status: base.status, priority: base.priority, dueDate: base.dueDate ? new Date(String(base.dueDate)) : base.dueDate, ownerId: base.ownerId || (creating ? user.id : undefined), assignedUserId: base.assignedUserId, clientId: base.clientId, leadId: base.leadId, contactId: base.contactId, dealId: base.dealId, ...(creating ? { createdById: user.id } : {}) };
  }

  private static async writeRow(tx: Prisma.TransactionClient, destination: ImportDestination, row: PreviewRow, organizationId: string, user: UserSession, definitions: Map<string, { id: string; fieldType: string }>) {
    const creating = row.action !== 'UPDATE';
    const data = this.baseData(destination, row.values, organizationId, user, creating) as any;
    if (destination === 'DEAL') {
      const stage = await tx.pipelineStage.findFirstOrThrow({ where: { id: data.stageId, pipelineId: data.pipelineId, organizationId, isActive: true }, select: { type: true, probability: true } });
      const stageChanged = creating || !row.matchId || (await tx.deal.findFirstOrThrow({ where: { id: row.matchId, organizationId, deletedAt: null }, select: { stageId: true } })).stageId !== data.stageId;
      if (stageChanged) {
        data.status = stage.type === 'WON' ? 'WON' : stage.type === 'LOST' ? 'LOST' : 'OPEN';
        data.probability ??= stage.probability;
      }
      if (creating && !data.currency) data.currency = (await tx.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { currency: true } })).currency;
    }
    let record: { id: string };
    const model = destination === 'CLIENT' ? tx.client : destination === 'LEAD' ? tx.lead : destination === 'CONTACT' ? tx.contact : destination === 'DEAL' ? tx.deal : tx.crmTask;
    if (row.action === 'UPDATE' && row.matchId) {
      const { organizationId: _organizationId, createdById: _createdById, ...updateData } = data;
      record = await (model as any).update({ where: { id: row.matchId }, data: updateData, select: { id: true } });
    } else record = await (model as any).create({ data, select: { id: true } });
    for (const [key, value] of Object.entries(row.values)) {
      if (!key.startsWith('custom:')) continue;
      const fieldKey = key.slice(7);
      const definition = definitions.get(fieldKey);
      const encoded = definition ? this.customValueData(definition.fieldType, value) : null;
      if (!definition || !encoded) continue;
      await tx.customFieldValue.upsert({
        where: { organizationId_fieldDefinitionId_entityType_entityId: { organizationId, fieldDefinitionId: definition.id, entityType: destination, entityId: record.id } },
        create: { organizationId, fieldDefinitionId: definition.id, entityType: destination, entityId: record.id, ...encoded },
        update: { valueText: null, valueNumber: null, valueBoolean: null, valueDate: null, valueJson: Prisma.JsonNull, ...encoded },
      });
    }
    return record;
  }

  static async confirm(user: UserSession, id: string, idempotencyKey: string, canCreateCustomFields: boolean) {
    const organizationId = (await requireOrganizationContext(user)).id;
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) throw new Error('Import configuration is invalid: invalid confirmation key');
    const job = await this.getOwned(user, id);
    if (['COMPLETED', 'PARTIAL'].includes(job.status)) return { replayed: true, imported: job.importedRows, updated: job.updatedRows, skipped: job.skippedRows, failed: job.failedRows, status: job.status };
    if (!job.destination || !job.mapping) throw new Error('Import configuration is invalid: preview the import first');
    if (job.idempotencyKey && job.idempotencyKey !== idempotencyKey) throw new Error('Import configuration is invalid: this draft was confirmed with another key');
    const claim = await prisma.dataImport.updateMany({ where: { id, organizationId, status: { in: ['READY', 'FAILED'] }, OR: [{ idempotencyKey: null }, { idempotencyKey }] }, data: { status: 'PROCESSING', idempotencyKey, startedAt: new Date(), errorMessage: null } });
    if (claim.count !== 1) throw new Error('The import could not be claimed because it is already processing or closed');
    try {
      const preview = await this.buildPreview(user, id, { destination: job.destination, mappings: asMappings(job.mapping), mode: job.mode, matchField: job.matchField }, canCreateCustomFields, false, true);
      const actionable = preview.rows;
      const rejected = actionable.filter((row) => row.action === 'REJECT');
      const skipped = actionable.filter((row) => row.action === 'SKIP');
      const writable = actionable.filter((row) => row.action === 'CREATE' || row.action === 'UPDATE');
      const proposed = preview.summary.proposedCustomFields;
      if (!writable.length) throw new Error('Import configuration is invalid: there are no valid rows to import');
      const result = await prisma.$transaction(async (tx) => {
        for (const field of proposed) await tx.customFieldDefinition.upsert({
          where: { organizationId_entityType_key: { organizationId, entityType: job.destination!, key: field.key } },
          create: { organizationId, entityType: job.destination!, key: field.key, label: field.label, fieldType: field.fieldType, required: !!field.required, searchable: !!field.searchable, ...(field.options ? { options: field.options } : {}), createdById: user.id, updatedById: user.id },
          update: {},
        });
        const definitions = await tx.customFieldDefinition.findMany({ where: { organizationId, entityType: job.destination!, archivedAt: null, active: true }, select: { id: true, key: true, fieldType: true } });
        const definitionMap = new Map(definitions.map((field) => [field.key, field]));
        let imported = 0, updated = 0;
        for (const row of writable) {
          await this.writeRow(tx, job.destination as ImportDestination, row, organizationId, user, definitionMap);
          row.action === 'UPDATE' ? updated++ : imported++;
        }
        const status = rejected.length ? 'PARTIAL' : 'COMPLETED';
        await tx.auditLog.create({ data: { organizationId, actorId: user.id, action: 'DATA_IMPORT_COMPLETED', entityType: 'DataImport', entityId: id, metadata: JSON.stringify({ destination: job.destination, imported, updated, skipped: skipped.length, failed: rejected.length }) } });
        await tx.dataImport.update({ where: { id }, data: { status, processedRows: actionable.length, importedRows: imported, updatedRows: updated, skippedRows: skipped.length, failedRows: rejected.length, failureRows: rejected.map((row) => ({ row: row.row, reasons: row.issues })) as unknown as Prisma.InputJsonValue, sourceRows: Prisma.DbNull, completedAt: new Date(), expiresAt: new Date(Date.now() + SMART_IMPORT_LIMITS.resultRetentionDays * 24 * 60 * 60 * 1000) } });
        return { imported, updated, status };
      }, { timeout: 60_000 });
      return { replayed: false, imported: result.imported, updated: result.updated, skipped: skipped.length, failed: rejected.length, status: result.status };
    } catch (error) {
      await prisma.dataImport.updateMany({ where: { id, organizationId, status: 'PROCESSING' }, data: { status: 'FAILED', errorMessage: safeMessage(error), completedAt: new Date() } });
      throw error;
    }
  }

  static async cancel(user: UserSession, id: string) {
    const organizationId = (await requireOrganizationContext(user)).id;
    const result = await prisma.dataImport.updateMany({ where: { id, organizationId, status: { in: ['DRAFT', 'READY', 'FAILED'] } }, data: { status: 'CANCELLED', sourceRows: Prisma.DbNull, completedAt: new Date() } });
    if (!result.count) throw new Error('Import cannot be cancelled');
  }
}
