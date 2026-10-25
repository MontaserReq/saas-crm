import { Prisma } from '@prisma/client';
import { parseOptionalEmail, parseOptionalInternationalPhone } from '@/lib/validation/contactInfo';
import prisma from '@/lib/db/prisma';
import { UserSession } from '@/types';
import { requireOrganizationContext } from '@/lib/auth/organization';
import { acquireOperation, RESOURCE_LIMITS, StaleOperationError, withOperationOwner } from '@/lib/security/resourceGuard';
import { evaluateCurrentOperationAuthorization } from '@/lib/security/operationAuthorization';
import { PERMISSIONS } from '@/lib/permissions';
import { AuditService } from './AuditService';
import type { SubscriptionAccess } from '@/lib/platform/entitlements';

export const WORKFLOW_ENTITIES = ['CLIENT', 'LEAD', 'CONTACT', 'DEAL', 'TASK', 'TICKET'] as const;
export const WORKFLOW_TRIGGERS = ['RECORD_CREATED', 'RECORD_UPDATED', 'DEAL_STAGE_CHANGED', 'DEAL_WON', 'DEAL_LOST', 'LEAD_STATUS_CHANGED', 'LEAD_CONVERTED', 'TASK_CREATED', 'TASK_COMPLETED', 'TASK_OVERDUE', 'TICKET_CREATED', 'TICKET_STATUS_CHANGED'] as const;
export const WORKFLOW_ACTIONS = ['CREATE_TASK', 'COMPLETE_TASK', 'UPDATE_RECORD', 'UPDATE_FIELD', 'MOVE_DEAL_STAGE', 'ASSIGN_OWNER', 'CREATE_NOTIFICATION', 'CREATE_ACTIVITY'] as const;

type Entity = typeof WORKFLOW_ENTITIES[number];
type Trigger = typeof WORKFLOW_TRIGGERS[number];
export type WorkflowEvent = { eventId: string; organizationId: string; entityType: Entity; entityId: string; eventType: Trigger; actorId?: string | null; depth?: number; originatingWorkflowId?: string };
type Condition = { field: string; operator: string; value?: unknown };
type Action = { type: string; [key: string]: unknown };
type DbClient = Prisma.TransactionClient | typeof prisma;
type WorkflowAuthorization = { allowed: boolean; access: SubscriptionAccess; reasonCode: string };
type PauseReason = {
  code: 'ENTITLEMENT_REQUIRED' | 'ENTITLEMENT_UNAVAILABLE';
  entitlementState: string;
  readOnly: boolean;
  requiredFeature: 'workflows';
  reasonCode: string;
  pausedAt: string;
};
type ExecutionMetadata = {
  version: 1;
  event: WorkflowEvent;
  actions: Action[];
  nextActionIndex: number;
  operationId?: string;
  lastResumedById?: string;
  pauseReason?: PauseReason;
};
type LockedExecution = {
  id: string;
  organizationId: string;
  workflowId: string;
  eventId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  status: string;
  metadata: Prisma.JsonValue | null;
};
export type WorkflowExecutionTestHookContext = {
  executionId: string;
  organizationId: string;
  operationId: string;
  ownerToken: string;
  actionIndex: number;
};
type WorkflowExecutionTestHooks = {
  beforeAction?: (context: WorkflowExecutionTestHookContext) => Promise<void> | void;
  afterBusinessWrite?: (context: WorkflowExecutionTestHookContext) => Promise<void> | void;
  afterActionCommitted?: (context: WorkflowExecutionTestHookContext) => Promise<void> | void;
};

let workflowExecutionTestHooks: WorkflowExecutionTestHooks | null = null;

/** Deterministic transaction/concurrency seams for the disposable PostgreSQL suite only. */
export function setWorkflowExecutionTestHooksForTests(hooks: WorkflowExecutionTestHooks | null) {
  if (process.env.NODE_ENV !== 'test') throw new Error('Workflow execution test hooks are available only in tests');
  workflowExecutionTestHooks = hooks;
}

class InvalidWorkflowCheckpointError extends Error {
  constructor(message = 'Workflow execution has no safe resumable checkpoint') {
    super(message);
    this.name = 'InvalidWorkflowCheckpointError';
  }
}

const ops = new Set(['equals', 'not_equals', 'exists', 'not_exists', 'is_empty', 'is_not_empty', 'contains', 'starts_with', 'ends_with', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'before', 'after', 'on', 'before_or_on', 'after_or_on', 'in', 'not_in']);
const fields: Record<string, Set<string>> = {
  CLIENT: new Set(['name', 'type', 'status', 'email', 'phone', 'category']),
  LEAD: new Set(['name', 'companyName', 'status', 'email', 'phone', 'source']),
  CONTACT: new Set(['firstName', 'lastName', 'jobTitle', 'email', 'phone', 'clientId']),
  DEAL: new Set(['title', 'status', 'value', 'currency', 'probability', 'pipelineId', 'stageId', 'ownerId']),
  TASK: new Set(['title', 'status', 'priority', 'dueDate', 'ownerId', 'assignedUserId']),
  TICKET: new Set(['subject', 'status', 'priority', 'departmentId', 'createdById']),
};

function entity(value: string): asserts value is Entity {
  if (!(WORKFLOW_ENTITIES as readonly string[]).includes(value)) throw new Error('Invalid workflow entity');
}
function trigger(value: string): asserts value is Trigger {
  if (!(WORKFLOW_TRIGGERS as readonly string[]).includes(value)) throw new Error('Invalid workflow trigger');
}
function json<T>(value: unknown, fallback: T): T {
  return value && typeof value === 'object' ? value as T : fallback;
}
function errorText(error: unknown) {
  return (error instanceof Error ? error.message : 'Workflow execution failed').slice(0, 500);
}
function metadata(value: unknown, execution?: LockedExecution): ExecutionMetadata {
  const parsed = json<Partial<ExecutionMetadata>>(value, {});
  if (parsed.version !== 1 || !parsed.event || typeof parsed.event !== 'object' || !Array.isArray(parsed.actions) || !Number.isInteger(parsed.nextActionIndex) || (parsed.nextActionIndex ?? -1) < 0 || (parsed.nextActionIndex ?? 0) > parsed.actions.length || parsed.actions.length < 1 || parsed.actions.length > 10) throw new InvalidWorkflowCheckpointError();
  if (parsed.actions.some(action => !action || typeof action !== 'object' || Array.isArray(action) || !(WORKFLOW_ACTIONS as readonly string[]).includes(String(action.type)))) throw new InvalidWorkflowCheckpointError();
  try { entity(parsed.event.entityType); trigger(parsed.event.eventType); } catch { throw new InvalidWorkflowCheckpointError(); }
  if (!parsed.event.eventId || !parsed.event.organizationId || !parsed.event.entityId || (parsed.event.actorId !== undefined && parsed.event.actorId !== null && typeof parsed.event.actorId !== 'string')) throw new InvalidWorkflowCheckpointError();
  if (execution && (parsed.event.organizationId !== execution.organizationId || parsed.event.eventId !== execution.eventId || parsed.event.eventType !== execution.eventType || parsed.event.entityType !== execution.entityType || parsed.event.entityId !== execution.entityId)) throw new InvalidWorkflowCheckpointError('Workflow execution checkpoint does not match its authoritative event context');
  return parsed as ExecutionMetadata;
}
function inputJson(value: ExecutionMetadata): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

export class WorkflowService {
  static async list(user: UserSession, includeArchived = false) {
    const organizationId = (await requireOrganizationContext(user)).id;
    return prisma.workflow.findMany({ where: { organizationId, ...(includeArchived ? {} : { archivedAt: null }) }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { executions: true } } } });
  }
  static async get(user: UserSession, id: string) {
    const organizationId = (await requireOrganizationContext(user)).id;
    return prisma.workflow.findFirst({ where: { id, organizationId, archivedAt: null }, include: { _count: { select: { executions: true } } } });
  }
  static async executions(user: UserSession, id: string) {
    const organizationId = (await requireOrganizationContext(user)).id;
    if (!(await prisma.workflow.findFirst({ where: { id, organizationId } }))) throw new Error('Workflow not found');
    return prisma.workflowExecution.findMany({ where: { workflowId: id, organizationId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }
  static async validateConfig(user: UserSession, input: { entityType: Entity; triggerType: Trigger; conditions: unknown; actions: unknown }) {
    const organizationId = (await requireOrganizationContext(user)).id;
    entity(input.entityType); trigger(input.triggerType);
    if (JSON.stringify(input).length > 50000) throw new Error('Workflow configuration is too large');
    const config = json<{ logic?: string; conditions?: Condition[] }>(input.conditions, {});
    const conditions = config.conditions || [];
    if (conditions.length > 25 || (config.logic && !['ALL', 'ANY'].includes(config.logic))) throw new Error('Invalid condition group');
    const custom = conditions.map(item => item.field).filter(field => !fields[input.entityType].has(field));
    if (custom.length) {
      const definitions = await prisma.customFieldDefinition.findMany({ where: { organizationId, entityType: input.entityType, key: { in: custom }, archivedAt: null }, select: { key: true } });
      if (definitions.length !== new Set(custom).size) throw new Error('Workflow references an invalid field');
    }
    for (const condition of conditions) if (!condition.field || !ops.has(condition.operator) || (!['exists', 'not_exists', 'is_empty', 'is_not_empty'].includes(condition.operator) && condition.value === undefined)) throw new Error('Invalid workflow condition');
    const actions = Array.isArray(input.actions) ? input.actions as Action[] : [];
    if (!actions.length || actions.length > 10 || actions.some(action => !WORKFLOW_ACTIONS.includes(action.type as any))) throw new Error('Invalid workflow actions');
    return true;
  }
  static async create(user: UserSession, input: { name: string; description?: string; entityType: Entity; triggerType: Trigger; conditions: unknown; actions: unknown }) {
    const organizationId = (await requireOrganizationContext(user)).id;
    if (!input.name?.trim()) throw new Error('Workflow name is required');
    await this.validateConfig(user, input);
    const workflow = await prisma.workflow.create({ data: { organizationId, name: input.name.trim(), description: input.description?.trim() || null, entityType: input.entityType, triggerType: input.triggerType, conditions: input.conditions as Prisma.InputJsonValue, actions: input.actions as Prisma.InputJsonValue, createdById: user.id, updatedById: user.id } });
    await AuditService.logAudit({ actorId: user.id, organizationId, action: 'WORKFLOW_CREATED', entityType: 'Workflow', entityId: workflow.id });
    return workflow;
  }
  static async update(user: UserSession, id: string, input: Partial<{ name: string; description: string; entityType: Entity; triggerType: Trigger; conditions: unknown; actions: unknown }>) {
    const organizationId = (await requireOrganizationContext(user)).id;
    const previous = await prisma.workflow.findFirst({ where: { id, organizationId, archivedAt: null } });
    if (!previous) throw new Error('Workflow not found');
    const next = { entityType: input.entityType || previous.entityType as Entity, triggerType: input.triggerType || previous.triggerType as Trigger, conditions: input.conditions ?? previous.conditions, actions: input.actions ?? previous.actions };
    await this.validateConfig(user, next);
    const workflow = await prisma.workflow.update({ where: { id }, data: { ...(input.name !== undefined ? { name: input.name.trim() } : {}), ...(input.description !== undefined ? { description: input.description.trim() || null } : {}), ...(input.entityType ? { entityType: input.entityType } : {}), ...(input.triggerType ? { triggerType: input.triggerType } : {}), ...(input.conditions !== undefined ? { conditions: input.conditions as Prisma.InputJsonValue } : {}), ...(input.actions !== undefined ? { actions: input.actions as Prisma.InputJsonValue } : {}), updatedById: user.id } });
    await AuditService.logAudit({ actorId: user.id, organizationId, action: 'WORKFLOW_UPDATED', entityType: 'Workflow', entityId: id });
    return workflow;
  }
  static async setActive(user: UserSession, id: string, active: boolean) {
    const organizationId = (await requireOrganizationContext(user)).id;
    if (!(await prisma.workflow.findFirst({ where: { id, organizationId, archivedAt: null } }))) throw new Error('Workflow not found');
    const workflow = await prisma.workflow.update({ where: { id }, data: { isActive: active, updatedById: user.id } });
    await AuditService.logAudit({ actorId: user.id, organizationId, action: active ? 'WORKFLOW_ACTIVATED' : 'WORKFLOW_DEACTIVATED', entityType: 'Workflow', entityId: id });
    return workflow;
  }
  static async archive(user: UserSession, id: string) {
    const organizationId = (await requireOrganizationContext(user)).id;
    if (!(await prisma.workflow.findFirst({ where: { id, organizationId, archivedAt: null } }))) throw new Error('Workflow not found');
    const workflow = await prisma.workflow.update({ where: { id }, data: { isActive: false, archivedAt: new Date(), updatedById: user.id } });
    await AuditService.logAudit({ actorId: user.id, organizationId, action: 'WORKFLOW_ARCHIVED', entityType: 'Workflow', entityId: id });
    return workflow;
  }
  static async restore(user: UserSession, id: string) {
    const organizationId = (await requireOrganizationContext(user)).id;
    const existing = await prisma.workflow.findFirst({ where: { id, organizationId, archivedAt: { not: null } } });
    if (!existing) throw new Error('Archived workflow not found');
    const workflow = await prisma.workflow.update({ where: { id }, data: { archivedAt: null, isActive: false, updatedById: user.id } });
    await AuditService.logAudit({ actorId: user.id, organizationId, action: 'WORKFLOW_RESTORED', entityType: 'Workflow', entityId: id });
    return workflow;
  }
  static async dispatch(event: WorkflowEvent) {
    entity(event.entityType); trigger(event.eventType);
    if ((event.depth || 0) > 3) return { matched: 0, skipped: 'depth' };
    const workflows = await prisma.workflow.findMany({ where: { organizationId: event.organizationId, entityType: event.entityType, triggerType: event.eventType, isActive: true, archivedAt: null } });
    let matched = 0;
    for (const workflow of workflows) {
      if (workflow.id === event.originatingWorkflowId) continue;
      if (await this.matches(workflow, event)) { matched++; await this.execute(workflow.id, event); }
    }
    return { matched };
  }
  /** Explicitly resumes a paused or lease-abandoned execution in the caller's tenant. */
  static async resume(user: UserSession, executionId: string) {
    const organizationId = (await requireOrganizationContext(user)).id;
    const execution = await prisma.workflowExecution.findFirst({ where: { id: executionId, organizationId } });
    if (!execution) throw new Error('Workflow execution not found');
    if (execution.status === 'COMPLETED') return { status: 'COMPLETED' as const };
    if (execution.status === 'FAILED') throw new Error('Failed workflow executions cannot be resumed');
    if (!['PENDING', 'RUNNING', 'PAUSED_ENTITLEMENT'].includes(execution.status)) throw new Error('Workflow execution cannot be resumed');
    return this.runExecution(execution.id, organizationId, user.id);
  }

  private static async load(db: DbClient, organizationId: string, type: Entity, id: string): Promise<any> {
    const where: any = { id, organizationId };
    const row = type === 'CLIENT' ? await db.client.findFirst({ where: { ...where, deletedAt: null } }) : type === 'LEAD' ? await db.lead.findFirst({ where: { ...where, deletedAt: null } }) : type === 'CONTACT' ? await db.contact.findFirst({ where: { ...where, deletedAt: null } }) : type === 'DEAL' ? await db.deal.findFirst({ where: { ...where, deletedAt: null } }) : type === 'TASK' ? await db.crmTask.findFirst({ where: { ...where, deletedAt: null } }) : await db.ticket.findFirst({ where });
    if (!row) throw new Error('Workflow entity not found in organization');
    return row;
  }
  private static async matches(workflow: { conditions: unknown }, event: WorkflowEvent) {
    const row = await this.load(prisma, event.organizationId, event.entityType, event.entityId);
    const values = await prisma.customFieldValue.findMany({ where: { organizationId: event.organizationId, entityType: event.entityType, entityId: event.entityId }, include: { fieldDefinition: { select: { key: true } } } });
    const data: any = { ...row, ...Object.fromEntries(values.map(value => [value.fieldDefinition.key, value.valueJson ?? value.valueText ?? value.valueNumber ?? value.valueBoolean ?? value.valueDate])) };
    const config = json<{ logic?: string; conditions?: Condition[] }>(workflow.conditions, {});
    const results = (config.conditions || []).map(condition => this.compare(data[condition.field], condition.operator, condition.value));
    return (config.logic || 'ALL') === 'ANY' ? results.some(Boolean) : results.every(Boolean);
  }
  private static compare(left: unknown, operator: string, right: unknown) {
    const empty = left === null || left === undefined || left === '';
    if (operator === 'exists' || operator === 'is_not_empty') return !empty;
    if (operator === 'not_exists' || operator === 'is_empty') return empty;
    if (operator === 'equals') return String(left) === String(right);
    if (operator === 'not_equals') return String(left) !== String(right);
    if (operator === 'contains') return String(left).toLowerCase().includes(String(right).toLowerCase());
    if (operator === 'starts_with') return String(left).startsWith(String(right));
    if (operator === 'ends_with') return String(left).endsWith(String(right));
    if (operator === 'in') return Array.isArray(right) && right.map(String).includes(String(left));
    if (operator === 'not_in') return Array.isArray(right) && !right.map(String).includes(String(left));
    if (['greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'].includes(operator)) return operator === 'greater_than' ? Number(left) > Number(right) : operator === 'greater_than_or_equal' ? Number(left) >= Number(right) : operator === 'less_than' ? Number(left) < Number(right) : Number(left) <= Number(right);
    const leftDate = new Date(String(left)).getTime(), rightDate = new Date(String(right)).getTime();
    return operator === 'before' ? leftDate < rightDate : operator === 'after' ? leftDate > rightDate : operator === 'before_or_on' ? leftDate <= rightDate : operator === 'after_or_on' ? leftDate >= rightDate : operator === 'on' ? new Date(leftDate).toISOString().slice(0, 10) === new Date(rightDate).toISOString().slice(0, 10) : false;
  }

  private static async execute(workflowId: string, event: WorkflowEvent) {
    if (!event.actorId) return;
    const workflow = await prisma.workflow.findFirst({ where: { id: workflowId, organizationId: event.organizationId, isActive: true, archivedAt: null } });
    if (!workflow) return;
    let execution: { id: string };
    try {
      execution = await prisma.workflowExecution.create({ data: { organizationId: event.organizationId, workflowId, eventId: event.eventId, eventType: event.eventType, entityType: event.entityType, entityId: event.entityId, status: 'PENDING', metadata: inputJson({ version: 1, event: { ...event, actorId: event.actorId, depth: event.depth || 0 }, actions: json<Action[]>(workflow.actions, []), nextActionIndex: 0 }) }, select: { id: true } });
    } catch (error: any) {
      if (error?.code === 'P2002') return;
      throw error;
    }
    await this.runExecution(execution.id, event.organizationId, event.actorId);
  }
  private static async lockExecution(tx: Prisma.TransactionClient, executionId: string, organizationId: string) {
    const rows = await tx.$queryRaw<LockedExecution[]>`
      SELECT "id", "organizationId", "workflowId", "eventId", "eventType", "entityType", "entityId", "status", "metadata"
      FROM "WorkflowExecution"
      WHERE "id" = ${executionId} AND "organizationId" = ${organizationId}
      FOR UPDATE
    `;
    return rows[0] ?? null;
  }
  private static async validateExecutionContext(tx: Prisma.TransactionClient, execution: LockedExecution) {
    const workflows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Workflow"
      WHERE "id" = ${execution.workflowId} AND "organizationId" = ${execution.organizationId}
      FOR SHARE
    `;
    if (workflows.length !== 1) throw new InvalidWorkflowCheckpointError('Workflow execution does not belong to its authoritative organization');
    const checkpoint = metadata(execution.metadata, execution);
    if (!checkpoint.event.actorId) throw new InvalidWorkflowCheckpointError();
    const actors = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "OrganizationMember"
      WHERE "organizationId" = ${execution.organizationId} AND "userId" = ${checkpoint.event.actorId} AND "status" = 'ACTIVE'
      FOR SHARE
    `;
    if (actors.length !== 1) throw new InvalidWorkflowCheckpointError('Workflow execution actor is not an active organization member');
    return checkpoint;
  }
  private static async terminalizeExecution(tx: Prisma.TransactionClient, execution: LockedExecution, message: string, actorId: string | null, auditAction: string) {
    await tx.workflowExecution.update({ where: { id: execution.id }, data: { status: 'FAILED', completedAt: new Date(), errorMessage: message, retryCount: { increment: 1 } } });
    await tx.auditLog.create({ data: { actorId, organizationId: execution.organizationId, action: auditAction, entityType: execution.entityType, entityId: execution.entityId, metadata: JSON.stringify({ workflowId: execution.workflowId, executionId: execution.id, error: message }) } });
  }
  private static async authoritativeEntitlement(tx: Prisma.TransactionClient, organizationId: string, actorId: string): Promise<WorkflowAuthorization> {
    return evaluateCurrentOperationAuthorization(tx, {
      organizationId,
      userId: actorId,
      feature: 'workflows',
      requiredPermissions: [PERMISSIONS.WORKFLOWS_EXECUTE],
    });
  }
  private static pauseReason(entitlement: WorkflowAuthorization | null): PauseReason {
    return { code: entitlement ? 'ENTITLEMENT_REQUIRED' : 'ENTITLEMENT_UNAVAILABLE', entitlementState: entitlement?.access.state ?? 'UNKNOWN', readOnly: entitlement?.access.readOnly ?? true, requiredFeature: 'workflows', reasonCode: entitlement?.reasonCode ?? 'ENTITLEMENT_CHECK_FAILED', pausedAt: new Date().toISOString() };
  }
  private static async markPausedWithoutOwner(executionId: string, organizationId: string, entitlement: WorkflowAuthorization | null) {
    return prisma.$transaction(async tx => {
      const execution = await this.lockExecution(tx, executionId, organizationId);
      if (!execution || ['COMPLETED', 'FAILED'].includes(execution.status)) return;
      const liveOwners = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "OperationExecution" WHERE "organizationId" = ${organizationId} AND "operationType" = 'WORKFLOW' AND "idempotencyKey" = ${executionId} AND "status" = 'RUNNING' AND "leaseExpiresAt" > (clock_timestamp() AT TIME ZONE 'UTC') LIMIT 1`;
      if (liveOwners.length) return;
      let checkpoint: ExecutionMetadata;
      try {
        checkpoint = await this.validateExecutionContext(tx, execution);
      } catch (error) {
        if (!(error instanceof InvalidWorkflowCheckpointError)) throw error;
        const message = errorText(error);
        await this.terminalizeExecution(tx, execution, message, null, 'WORKFLOW_NON_RESUMABLE');
        await tx.operationExecution.updateMany({ where: { organizationId, operationType: 'WORKFLOW', idempotencyKey: executionId, status: { in: ['PENDING', 'RUNNING', 'EXPIRED'] } }, data: { status: 'FAILED', completedAt: new Date(), leaseExpiresAt: null, ownerToken: null, failureReason: message } });
        return 'NON_RESUMABLE' as const;
      }
      const reason = this.pauseReason(entitlement);
      await tx.workflowExecution.update({ where: { id: executionId }, data: { status: 'PAUSED_ENTITLEMENT', errorMessage: null, completedAt: null, metadata: inputJson({ ...checkpoint, pauseReason: reason }) } });
      await tx.auditLog.create({ data: { actorId: checkpoint.event.actorId || null, organizationId, action: 'WORKFLOW_PAUSED_ENTITLEMENT', entityType: execution.entityType, entityId: execution.entityId, metadata: JSON.stringify({ workflowExecutionId: executionId, nextActionIndex: checkpoint.nextActionIndex, reason }) } });
      return 'PAUSED' as const;
    });
  }
  private static async runExecution(executionId: string, organizationId: string, resumerId: string) {
    let entitlement: WorkflowAuthorization | null = null;
    let acquisition;
    try {
      acquisition = await acquireOperation({
        organizationId,
        userId: resumerId,
        operationType: 'WORKFLOW',
        idempotencyKey: executionId,
        limits: RESOURCE_LIMITS.WORKFLOW,
        authorize: async tx => {
          const execution = await this.lockExecution(tx, executionId, organizationId);
          if (!execution) return false;
          let checkpoint: ExecutionMetadata;
          try {
            checkpoint = await this.validateExecutionContext(tx, execution);
          } catch (error) {
            // Acquire a fenced operation for malformed legacy checkpoints so
            // the normal failure path records a durable terminal operation and
            // audit event instead of leaving an untracked execution.
            if (error instanceof InvalidWorkflowCheckpointError) return true;
            throw error;
          }
          entitlement = await this.authoritativeEntitlement(tx, organizationId, checkpoint.event.actorId!);
          return entitlement.allowed;
        },
      });
    } catch (error) {
      const outcome = await this.markPausedWithoutOwner(executionId, organizationId, null).catch(() => undefined);
      if (outcome === 'NON_RESUMABLE') return { status: 'NON_RESUMABLE' as const, error: 'Workflow execution has no safe resumable checkpoint' };
      return { status: 'PAUSED_ENTITLEMENT' as const, error: errorText(error) };
    }
    if (!acquisition.acquired || !acquisition.execution?.ownerToken) {
      if (acquisition.reason === 'NOT_AUTHORIZED') {
        const outcome = await this.markPausedWithoutOwner(executionId, organizationId, entitlement);
        if (outcome === 'NON_RESUMABLE') return { status: 'NON_RESUMABLE' as const, error: 'Workflow execution has no safe resumable checkpoint' };
        return { status: 'PAUSED_ENTITLEMENT' as const };
      }
      return { status: acquisition.reason as 'IN_PROGRESS' | 'COMPLETED' | 'BUSY' };
    }
    const operationId = acquisition.execution.id, ownerToken = acquisition.execution.ownerToken;
    try {
      const checkpoint = await withOperationOwner(operationId, ownerToken, async tx => {
        const execution = await this.lockExecution(tx, executionId, organizationId);
        if (!execution || !['PENDING', 'RUNNING', 'PAUSED_ENTITLEMENT'].includes(execution.status)) throw new StaleOperationError();
        const saved = await this.validateExecutionContext(tx, execution), claimed = { ...saved, operationId, lastResumedById: resumerId };
        delete claimed.pauseReason;
        await tx.workflowExecution.update({ where: { id: executionId }, data: { status: 'RUNNING', startedAt: new Date(), completedAt: null, errorMessage: null, metadata: inputJson(claimed) } });
        return claimed;
      });
      for (let index = checkpoint.nextActionIndex; index < checkpoint.actions.length; index++) {
        const hookContext = { executionId, organizationId, operationId, ownerToken, actionIndex: index };
        await workflowExecutionTestHooks?.beforeAction?.(hookContext);
        const actionResult = await this.runAction(executionId, organizationId, operationId, ownerToken, index);
        if (actionResult === 'PAUSED') return { status: 'PAUSED_ENTITLEMENT' as const };
        if (actionResult === 'EXECUTED') await workflowExecutionTestHooks?.afterActionCommitted?.(hookContext);
      }
      const completed = await this.completeExecution(executionId, organizationId, operationId, ownerToken);
      return { status: completed ? 'COMPLETED' as const : 'PAUSED_ENTITLEMENT' as const };
    } catch (error) {
      if (error instanceof StaleOperationError) return { status: 'IN_PROGRESS' as const };
      await this.failExecution(executionId, organizationId, operationId, ownerToken, resumerId, error).catch(() => undefined);
      return { status: error instanceof InvalidWorkflowCheckpointError ? 'NON_RESUMABLE' as const : 'FAILED' as const, error: errorText(error) };
    }
  }
  private static async runAction(executionId: string, organizationId: string, operationId: string, ownerToken: string, actionIndex: number) {
    return withOperationOwner(operationId, ownerToken, async tx => {
      const execution = await this.lockExecution(tx, executionId, organizationId);
      if (!execution || execution.status !== 'RUNNING') throw new StaleOperationError();
      const checkpoint = await this.validateExecutionContext(tx, execution);
      if (checkpoint.nextActionIndex > actionIndex) return 'ALREADY_ADVANCED' as const;
      if (checkpoint.nextActionIndex !== actionIndex || !checkpoint.actions[actionIndex]) throw new Error('Workflow execution checkpoint is inconsistent');
      const entitlement = await this.authoritativeEntitlement(tx, organizationId, checkpoint.event.actorId!);
      if (!entitlement.allowed) {
        const reason = this.pauseReason(entitlement);
        await tx.workflowExecution.update({ where: { id: executionId }, data: { status: 'PAUSED_ENTITLEMENT', completedAt: null, errorMessage: null, metadata: inputJson({ ...checkpoint, pauseReason: reason }) } });
        await tx.operationExecution.updateMany({ where: { id: operationId, ownerToken, status: 'RUNNING' }, data: { status: 'EXPIRED', ownerToken: null, leaseExpiresAt: null, completedAt: null, failureReason: 'PAUSED_ENTITLEMENT' } });
        await tx.auditLog.create({ data: { actorId: checkpoint.event.actorId || null, organizationId, action: 'WORKFLOW_PAUSED_ENTITLEMENT', entityType: checkpoint.event.entityType, entityId: checkpoint.event.entityId, metadata: JSON.stringify({ workflowId: execution.workflowId, workflowExecutionId: executionId, nextActionIndex: checkpoint.nextActionIndex, reason }) } });
        return 'PAUSED' as const;
      }
      await this.action(tx, checkpoint.actions[actionIndex], checkpoint.event);
      await workflowExecutionTestHooks?.afterBusinessWrite?.({ executionId, organizationId, operationId, ownerToken, actionIndex });
      const advanced = { ...checkpoint, nextActionIndex: actionIndex + 1 };
      delete advanced.pauseReason;
      await tx.workflowExecution.update({ where: { id: executionId }, data: { metadata: inputJson(advanced) } });
      await tx.$executeRaw`UPDATE "OperationExecution" SET "leaseExpiresAt" = (clock_timestamp() AT TIME ZONE 'UTC') + (${RESOURCE_LIMITS.WORKFLOW.leaseMs} * INTERVAL '1 millisecond'), "updatedAt" = (clock_timestamp() AT TIME ZONE 'UTC') WHERE "id" = ${operationId} AND "ownerToken" = ${ownerToken} AND "status" = 'RUNNING'`;
      return 'EXECUTED' as const;
    });
  }
  private static async completeExecution(executionId: string, organizationId: string, operationId: string, ownerToken: string) {
    return withOperationOwner(operationId, ownerToken, async tx => {
      const execution = await this.lockExecution(tx, executionId, organizationId);
      if (!execution || execution.status !== 'RUNNING') throw new StaleOperationError();
      const checkpoint = await this.validateExecutionContext(tx, execution);
      if (checkpoint.nextActionIndex !== checkpoint.actions.length) throw new Error('Workflow execution is not ready to complete');
      const entitlement = await this.authoritativeEntitlement(tx, organizationId, checkpoint.event.actorId!);
      if (!entitlement.allowed) {
        const reason = this.pauseReason(entitlement);
        await tx.workflowExecution.update({ where: { id: executionId }, data: { status: 'PAUSED_ENTITLEMENT', completedAt: null, errorMessage: null, metadata: inputJson({ ...checkpoint, pauseReason: reason }) } });
        await tx.operationExecution.updateMany({ where: { id: operationId, ownerToken, status: 'RUNNING' }, data: { status: 'EXPIRED', ownerToken: null, leaseExpiresAt: null, completedAt: null, failureReason: 'PAUSED_ENTITLEMENT' } });
        await tx.auditLog.create({ data: { actorId: checkpoint.event.actorId || null, organizationId, action: 'WORKFLOW_PAUSED_ENTITLEMENT', entityType: checkpoint.event.entityType, entityId: checkpoint.event.entityId, metadata: JSON.stringify({ workflowId: execution.workflowId, workflowExecutionId: executionId, nextActionIndex: checkpoint.nextActionIndex, reason }) } });
        return false;
      }
      await tx.workflowExecution.update({ where: { id: executionId }, data: { status: 'COMPLETED', completedAt: new Date(), errorMessage: null } });
      await tx.operationExecution.updateMany({ where: { id: operationId, ownerToken, status: 'RUNNING' }, data: { status: 'SUCCEEDED', completedAt: new Date(), leaseExpiresAt: null, ownerToken: null, failureReason: null, resultPayload: JSON.stringify({ workflowExecutionId: executionId, confirmedActions: checkpoint.nextActionIndex }) } });
      await tx.auditLog.create({ data: { actorId: checkpoint.event.actorId || null, organizationId, action: 'WORKFLOW_EXECUTED', entityType: execution.entityType, entityId: execution.entityId, metadata: JSON.stringify({ workflowId: execution.workflowId, executionId, confirmedActions: checkpoint.nextActionIndex }) } });
      return true;
    });
  }
  private static async failExecution(executionId: string, organizationId: string, operationId: string, ownerToken: string, resumerId: string, error: unknown) {
    await withOperationOwner(operationId, ownerToken, async tx => {
      const execution = await this.lockExecution(tx, executionId, organizationId);
      if (!execution || ['COMPLETED', 'FAILED'].includes(execution.status)) throw new StaleOperationError();
      const message = errorText(error);
      await this.terminalizeExecution(tx, execution, message, resumerId, error instanceof InvalidWorkflowCheckpointError ? 'WORKFLOW_NON_RESUMABLE' : 'WORKFLOW_FAILED');
      await tx.operationExecution.updateMany({ where: { id: operationId, ownerToken, status: 'RUNNING' }, data: { status: 'FAILED', completedAt: new Date(), leaseExpiresAt: null, ownerToken: null, failureReason: message } });
    });
  }

  private static async validateFieldUpdate(tx: Prisma.TransactionClient, event: WorkflowEvent, row: any, field: string, value: unknown) {
    const organizationId = event.organizationId;
    if ((event.entityType === 'DEAL' && field === 'ownerId') || (event.entityType === 'TASK' && ['ownerId', 'assignedUserId'].includes(field)) || (event.entityType === 'TICKET' && field === 'createdById')) {
      if (!(await tx.organizationMember.findFirst({ where: { organizationId, userId: String(value), status: 'ACTIVE' }, select: { id: true } }))) throw new Error('Workflow user target is not in organization');
    }
    if (event.entityType === 'CONTACT' && field === 'clientId' && value !== null) {
      if (!(await tx.client.findFirst({ where: { id: String(value), organizationId, deletedAt: null }, select: { id: true } }))) throw new Error('Workflow client target is not in organization');
    }
    if (event.entityType === 'DEAL' && field === 'pipelineId') {
      const pipeline = await tx.pipeline.findFirst({ where: { id: String(value), organizationId, isActive: true }, select: { id: true } });
      const currentStage = await tx.pipelineStage.findFirst({ where: { id: row.stageId, organizationId, pipelineId: String(value), isActive: true }, select: { id: true } });
      if (!pipeline || !currentStage) throw new Error('Workflow pipeline target is not compatible with the current stage');
    }
    if (event.entityType === 'DEAL' && field === 'stageId') {
      if (!(await tx.pipelineStage.findFirst({ where: { id: String(value), organizationId, pipelineId: row.pipelineId, isActive: true }, select: { id: true } }))) throw new Error('Workflow stage target is not in the organization pipeline');
    }
    if (event.entityType === 'TICKET' && field === 'departmentId') {
      if (!(await tx.department.findFirst({ where: { id: String(value), organizationId, isActive: true }, select: { id: true } }))) throw new Error('Workflow department target is not in organization');
    }
    if (field === 'email') return parseOptionalEmail(value);
    if (field === 'phone') return parseOptionalInternationalPhone(value);
    return value;
  }

  private static async action(tx: Prisma.TransactionClient, action: Action, event: WorkflowEvent) {
    const actorId = event.actorId;
    if (!actorId) throw new Error('Workflow actor is required');
    if (!(await tx.organizationMember.findFirst({ where: { organizationId: event.organizationId, userId: actorId, status: 'ACTIVE' }, select: { id: true } }))) throw new Error('Workflow actor is not an organization member');
    const row = await this.load(tx, event.organizationId, event.entityType, event.entityId);
    if (action.type === 'CREATE_TASK') {
      await tx.crmTask.create({ data: { organizationId: event.organizationId, title: String(action.title || `Follow up: ${row.name || row.title || event.entityId}`), description: action.description ? String(action.description) : null, dueDate: action.dueInDays === undefined ? null : new Date(Date.now() + Number(action.dueInDays) * 86400000), ownerId: actorId, createdById: actorId, clientId: event.entityType === 'CLIENT' ? event.entityId : null, leadId: event.entityType === 'LEAD' ? event.entityId : null, contactId: event.entityType === 'CONTACT' ? event.entityId : null, dealId: event.entityType === 'DEAL' ? event.entityId : null } });
      return;
    }
    if (action.type === 'COMPLETE_TASK') {
      if (event.entityType !== 'TASK') throw new Error('COMPLETE_TASK requires a task');
      const updated = await tx.crmTask.updateMany({ where: { id: event.entityId, organizationId: event.organizationId, deletedAt: null }, data: { status: 'COMPLETED', completedAt: new Date() } });
      if (updated.count !== 1) throw new Error('Workflow task is no longer available');
      return;
    }
    if (action.type === 'MOVE_DEAL_STAGE') {
      if (event.entityType !== 'DEAL') throw new Error('MOVE_DEAL_STAGE requires a deal');
      const stage = await tx.pipelineStage.findFirst({ where: { id: String(action.stageId), organizationId: event.organizationId, pipelineId: row.pipelineId, isActive: true } });
      if (!stage) throw new Error('Target stage is not in the organization pipeline');
      const updated = await tx.deal.updateMany({ where: { id: event.entityId, organizationId: event.organizationId, deletedAt: null }, data: { stageId: stage.id, status: stage.type === 'WON' ? 'WON' : stage.type === 'LOST' ? 'LOST' : 'OPEN' } });
      if (updated.count !== 1) throw new Error('Workflow deal is no longer available');
      return;
    }
    if (action.type === 'CREATE_NOTIFICATION') {
      const userId = String(action.userId || actorId);
      if (!(await tx.organizationMember.findFirst({ where: { organizationId: event.organizationId, userId, status: 'ACTIVE' } }))) throw new Error('Notification target is not in the organization');
      await tx.notification.create({ data: { userId, organizationId: event.organizationId, type: 'WORKFLOW', title: String(action.title || 'Workflow notification'), message: String(action.message || 'A workflow action was triggered.'), entityType: event.entityType, entityId: event.entityId } });
      return;
    }
    if (action.type === 'CREATE_ACTIVITY') {
      await tx.auditLog.create({ data: { actorId, organizationId: event.organizationId, action: 'WORKFLOW_ACTIVITY', entityType: event.entityType, entityId: event.entityId, metadata: JSON.stringify({ title: action.title || 'Workflow activity', description: action.description || null }) } });
      return;
    }
    if (action.type === 'ASSIGN_OWNER') {
      const userId = String(action.userId);
      if (!(await tx.organizationMember.findFirst({ where: { organizationId: event.organizationId, userId, status: 'ACTIVE' } }))) throw new Error('Owner is not in organization');
      const data: any = event.entityType === 'DEAL' || event.entityType === 'TASK' ? { ownerId: userId } : event.entityType === 'LEAD' || event.entityType === 'CONTACT' ? { assignedUserId: userId } : null;
      if (!data) throw new Error('Owner assignment unsupported');
      const result = event.entityType === 'DEAL' ? await tx.deal.updateMany({ where: { id: event.entityId, organizationId: event.organizationId, deletedAt: null }, data }) : event.entityType === 'TASK' ? await tx.crmTask.updateMany({ where: { id: event.entityId, organizationId: event.organizationId, deletedAt: null }, data }) : event.entityType === 'LEAD' ? await tx.lead.updateMany({ where: { id: event.entityId, organizationId: event.organizationId, deletedAt: null }, data }) : await tx.contact.updateMany({ where: { id: event.entityId, organizationId: event.organizationId, deletedAt: null }, data });
      if (result.count !== 1) throw new Error('Workflow entity is no longer available');
      return;
    }
    if (action.type === 'UPDATE_RECORD' || action.type === 'UPDATE_FIELD') {
      const field = String(action.field);
      if (!fields[event.entityType].has(field)) throw new Error('Workflow cannot update this field');
      const normalizedValue = await this.validateFieldUpdate(tx, event, row, field, action.value);
      const data: any = { [field]: normalizedValue };
      const result = event.entityType === 'CLIENT' ? await tx.client.updateMany({ where: { id: event.entityId, organizationId: event.organizationId, deletedAt: null }, data }) : event.entityType === 'LEAD' ? await tx.lead.updateMany({ where: { id: event.entityId, organizationId: event.organizationId, deletedAt: null }, data }) : event.entityType === 'CONTACT' ? await tx.contact.updateMany({ where: { id: event.entityId, organizationId: event.organizationId, deletedAt: null }, data }) : event.entityType === 'DEAL' ? await tx.deal.updateMany({ where: { id: event.entityId, organizationId: event.organizationId, deletedAt: null }, data }) : event.entityType === 'TASK' ? await tx.crmTask.updateMany({ where: { id: event.entityId, organizationId: event.organizationId, deletedAt: null }, data }) : await tx.ticket.updateMany({ where: { id: event.entityId, organizationId: event.organizationId }, data });
      if (result.count !== 1) throw new Error('Workflow entity is no longer available');
    }
  }
}
