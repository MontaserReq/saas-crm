import { Prisma } from '@prisma/client';
import prisma from '@/lib/db/prisma';
import { UserSession } from '@/types';
import { requireOrganizationContext } from '@/lib/auth/organization';
import { AuditService } from './AuditService';

export const CUSTOM_FIELD_ENTITIES = ['CLIENT', 'LEAD', 'CONTACT', 'DEAL', 'TICKET', 'TASK'] as const;
export const CUSTOM_FIELD_TYPES = ['TEXT', 'TEXTAREA', 'NUMBER', 'CURRENCY', 'BOOLEAN', 'DATE', 'DATETIME', 'EMAIL', 'PHONE', 'URL', 'SELECT', 'MULTI_SELECT'] as const;
export type CustomFieldEntity = typeof CUSTOM_FIELD_ENTITIES[number];
export type CustomFieldType = typeof CUSTOM_FIELD_TYPES[number];
export type CustomFieldInput = { key: string; value: unknown };

const entitySet = new Set<string>(CUSTOM_FIELD_ENTITIES);
const typeSet = new Set<string>(CUSTOM_FIELD_TYPES);
const keyPattern = /^[a-z][a-z0-9_]{1,63}$/;
const empty = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && !v.trim());

function assertEntity(entityType: string): asserts entityType is CustomFieldEntity { if (!entitySet.has(entityType)) throw new Error('Unsupported custom field entity'); }
function assertType(fieldType: string): asserts fieldType is CustomFieldType { if (!typeSet.has(fieldType)) throw new Error('Unsupported custom field type'); }
function optionsOf(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options.map((o) => typeof o === 'string' ? o.trim() : (o && typeof o === 'object' && 'value' in o ? String((o as { value: unknown }).value).trim() : '')).filter(Boolean);
}
function normalizeOptions(fieldType: string, options: unknown) {
  assertType(fieldType);
  if (!['SELECT', 'MULTI_SELECT'].includes(fieldType)) return null;
  const values = optionsOf(options);
  if (!values.length || new Set(values).size !== values.length) throw new Error('Select fields require unique options');
  return values;
}

async function assertEntityExists(tx: Prisma.TransactionClient | typeof prisma, organizationId: string, entityType: CustomFieldEntity, entityId: string) {
  const where = { id: entityId, organizationId, ...(entityType === 'CLIENT' || entityType === 'LEAD' || entityType === 'CONTACT' || entityType === 'DEAL' || entityType === 'TASK' ? { deletedAt: null } : {}) } as any;
  const record = entityType === 'CLIENT' ? await tx.client.findFirst({ where, select: { id: true } })
    : entityType === 'LEAD' ? await tx.lead.findFirst({ where, select: { id: true } })
    : entityType === 'CONTACT' ? await tx.contact.findFirst({ where, select: { id: true } })
    : entityType === 'DEAL' ? await tx.deal.findFirst({ where, select: { id: true } })
    : entityType === 'TASK' ? await tx.crmTask.findFirst({ where, select: { id: true } })
    : await tx.ticket.findFirst({ where: { id: entityId, organizationId }, select: { id: true } });
  if (!record) throw new Error('Entity not found in the active organization');
}

function encodeValue(fieldType: CustomFieldType, value: unknown): Partial<Prisma.CustomFieldValueUncheckedCreateInput> {
  if (empty(value)) throw new Error('Required custom field value is missing');
  if (fieldType === 'NUMBER' || fieldType === 'CURRENCY') {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) throw new Error('Custom field value must be a number');
    return { valueNumber: n };
  }
  if (fieldType === 'BOOLEAN') {
    if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') throw new Error('Custom field value must be boolean');
    return { valueBoolean: value === true || value === 'true' };
  }
  if (fieldType === 'DATE' || fieldType === 'DATETIME') {
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) throw new Error('Custom field value must be a valid date');
    return { valueDate: date };
  }
  if (fieldType === 'MULTI_SELECT') {
    if (!Array.isArray(value)) throw new Error('Multi-select value must be an array');
    return { valueJson: value.map(String) };
  }
  const text = String(value).trim();
  if (fieldType === 'EMAIL' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) throw new Error('Custom field value must be a valid email');
  if (fieldType === 'URL' && !/^https?:\/\//i.test(text)) throw new Error('Custom field value must be a valid URL');
  return { valueText: text };
}

export class CustomFieldService {
  static async listDefinitions(user: UserSession, entityType?: CustomFieldEntity) {
    const organizationId = (await requireOrganizationContext(user)).id;
    if (entityType) assertEntity(entityType);
    return prisma.customFieldDefinition.findMany({ where: { organizationId, ...(entityType ? { entityType } : {}), archivedAt: null }, orderBy: [{ entityType: 'asc' }, { displayOrder: 'asc' }, { createdAt: 'asc' }] });
  }

  static async createDefinition(user: UserSession, input: { entityType: CustomFieldEntity; key: string; label: string; description?: string; fieldType: CustomFieldType; required?: boolean; searchable?: boolean; displayOrder?: number; options?: unknown }) {
    const organizationId = (await requireOrganizationContext(user)).id;
    assertEntity(input.entityType); assertType(input.fieldType);
    const key = input.key.trim().toLowerCase();
    if (!keyPattern.test(key)) throw new Error('Field key must be lowercase snake_case and 2-64 characters');
    if (!input.label?.trim()) throw new Error('Field label is required');
    const normalizedOptions = normalizeOptions(input.fieldType, input.options);
    const definition = await prisma.customFieldDefinition.create({ data: { organizationId, entityType: input.entityType, key, label: input.label.trim(), description: input.description?.trim() || null, fieldType: input.fieldType, required: !!input.required, searchable: !!input.searchable, displayOrder: input.displayOrder || 0, ...(normalizedOptions ? { options: normalizedOptions } : {}), createdById: user.id, updatedById: user.id } });
    await AuditService.logAudit({ actorId: user.id, organizationId, action: 'CUSTOM_FIELD_CREATED', entityType: 'CustomFieldDefinition', entityId: definition.id, metadata: { entityType: input.entityType, key } });
    return definition;
  }

  static async updateDefinition(user: UserSession, id: string, input: Partial<{ label: string; description: string; required: boolean; searchable: boolean; displayOrder: number; options: unknown; active: boolean }>) {
    const organizationId = (await requireOrganizationContext(user)).id;
    const existing = await prisma.customFieldDefinition.findFirst({ where: { id, organizationId, archivedAt: null } });
    if (!existing) throw new Error('Custom field not found');
    const data: any = { updatedBy: { connect: { id: user.id } } };
    if (input.label !== undefined) data.label = input.label.trim();
    if (input.description !== undefined) data.description = input.description.trim() || null;
    if (input.required !== undefined) data.required = !!input.required;
    if (input.searchable !== undefined) data.searchable = !!input.searchable;
    if (input.displayOrder !== undefined) data.displayOrder = input.displayOrder;
    if (input.active !== undefined) data.active = !!input.active;
    if (input.options !== undefined) { const normalizedOptions = normalizeOptions(existing.fieldType, input.options); data.options = normalizedOptions || Prisma.JsonNull; }
    const definition = await prisma.customFieldDefinition.update({ where: { id }, data });
    await AuditService.logAudit({ actorId: user.id, organizationId, action: 'CUSTOM_FIELD_UPDATED', entityType: 'CustomFieldDefinition', entityId: id });
    return definition;
  }

  static async archiveDefinition(user: UserSession, id: string) {
    const organizationId = (await requireOrganizationContext(user)).id;
    const existing = await prisma.customFieldDefinition.findFirst({ where: { id, organizationId, archivedAt: null } });
    if (!existing) throw new Error('Custom field not found');
    const definition = await prisma.customFieldDefinition.update({ where: { id }, data: { active: false, archivedAt: new Date(), updatedBy: { connect: { id: user.id } } } });
    await AuditService.logAudit({ actorId: user.id, organizationId, action: 'CUSTOM_FIELD_ARCHIVED', entityType: 'CustomFieldDefinition', entityId: id });
    return definition;
  }

  static async setValues(user: UserSession, entityType: CustomFieldEntity, entityId: string, values: Record<string, unknown>) {
    const organizationId = (await requireOrganizationContext(user)).id;
    return prisma.$transaction((tx) => this.persistValues(tx, organizationId, user.id, entityType, entityId, values));
  }

  static async persistValues(tx: Prisma.TransactionClient, organizationId: string, actorId: string, entityType: CustomFieldEntity, entityId: string, values: Record<string, unknown>) {
    assertEntity(entityType); await assertEntityExists(tx, organizationId, entityType, entityId);
    const definitions = await tx.customFieldDefinition.findMany({ where: { organizationId, entityType, archivedAt: null } });
    const byKey = new Map(definitions.map((d) => [d.key, d]));
    const current = await tx.customFieldValue.findMany({ where: { organizationId, entityType, entityId } });
    const currentByDefinition = new Map(current.map((v) => [v.fieldDefinitionId, v]));
    for (const definition of definitions) {
      if (definition.required && empty(values[definition.key]) && !currentByDefinition.has(definition.id)) throw new Error(`Required custom field missing: ${definition.label}`);
    }
    for (const [key, value] of Object.entries(values)) {
      const definition = byKey.get(key);
      if (!definition) throw new Error(`Unknown custom field: ${key}`);
      if (!definition.active) throw new Error(`Custom field is inactive: ${key}`);
      if (empty(value)) { await tx.customFieldValue.deleteMany({ where: { organizationId, fieldDefinitionId: definition.id, entityType, entityId } }); continue; }
      const options = optionsOf(definition.options);
      const chosen = definition.fieldType === 'MULTI_SELECT' && Array.isArray(value) ? value.map(String) : [String(value)];
      if ((definition.fieldType === 'SELECT' || definition.fieldType === 'MULTI_SELECT') && chosen.some((v) => !options.includes(v))) throw new Error(`Invalid option for custom field: ${key}`);
      const encoded = encodeValue(definition.fieldType as CustomFieldType, value);
      await tx.customFieldValue.upsert({ where: { organizationId_fieldDefinitionId_entityType_entityId: { organizationId, fieldDefinitionId: definition.id, entityType, entityId } }, create: { organizationId, fieldDefinitionId: definition.id, entityType, entityId, ...encoded }, update: { valueText: null, valueNumber: null, valueBoolean: null, valueDate: null, valueJson: Prisma.JsonNull, ...encoded } });
    }
    await AuditService.logAudit({ actorId, organizationId, action: 'CUSTOM_FIELD_VALUES_UPDATED', entityType, entityId });
    return this.getEntityValuesById(tx, organizationId, entityType, entityId);
  }

  static async getEntityValues(user: UserSession, entityType: CustomFieldEntity, entityId: string) {
    const organizationId = (await requireOrganizationContext(user)).id;
    return this.getEntityValuesById(prisma, organizationId, entityType, entityId);
  }

  private static async getEntityValuesById(tx: Prisma.TransactionClient | typeof prisma, organizationId: string, entityType: CustomFieldEntity, entityId: string) {
    return tx.customFieldValue.findMany({ where: { organizationId, entityType, entityId }, include: { fieldDefinition: true }, orderBy: { fieldDefinition: { displayOrder: 'asc' } } });
  }
}
