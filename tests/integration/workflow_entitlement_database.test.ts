import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import prisma from '@/lib/db/prisma';
import { WorkflowService, setWorkflowExecutionTestHooksForTests, type WorkflowEvent } from '@/server/services/WorkflowService';

const run = process.env.RUN_WORKFLOW_DB === '1' && process.env.CONFIRM_DISPOSABLE_WORKFLOW_DB === '1' && Boolean(process.env.DATABASE_URL);

describe.skipIf(!run)('Workflow entitlement execution safety (PostgreSQL)', () => {
  const suffix = crypto.randomUUID();
  const roleId = `workflow-role-${suffix}`;
  const roleName = `WORKFLOW_TEST_${suffix}`;
  const departmentId = `workflow-department-${suffix}`;
  const departmentCode = `WORKFLOW_TEST_${suffix}`;
  const userId = `workflow-user-${suffix}`;
  const userEmail = `workflow-${suffix}@example.invalid`;
  const rolePermissionId = `workflow-role-permission-${suffix}`;
  let organizationId = '';
  let otherOrganizationId = '';
  let planId = '';
  let databaseConnected = false;

  const session = () => ({ id: userId, organizationId, permissions: ['workflows.execute'] }) as any;
  const writableWindow = () => ({ status: 'ACTIVE', startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3_600_000) });

  async function setWritable() {
    await prisma.platformPlan.update({ where: { id: planId }, data: { isActive: true, features: JSON.stringify(['workflows']) } });
    await prisma.platformSubscription.upsert({ where: { organizationId }, create: { organizationId, planId, ...writableWindow() }, update: { planId, ...writableWindow() } });
  }

  async function fixture(actions: Array<Record<string, unknown>>, org = organizationId) {
    const client = await prisma.client.create({ data: { organizationId: org, name: `Workflow source ${crypto.randomUUID()}` } });
    const workflow = await prisma.workflow.create({ data: { organizationId: org, name: `Workflow ${crypto.randomUUID()}`, entityType: 'CLIENT', triggerType: 'RECORD_CREATED', conditions: { logic: 'ALL', conditions: [] }, actions: actions as Prisma.InputJsonValue, isActive: true, createdById: userId, updatedById: userId } });
    const event: WorkflowEvent = { eventId: `event-${crypto.randomUUID()}`, organizationId: org, entityType: 'CLIENT', entityId: client.id, eventType: 'RECORD_CREATED', actorId: userId };
    return { client, workflow, event };
  }

  async function checkpointFixture(actions: Array<Record<string, unknown>>, nextActionIndex = 0, org = organizationId) {
    const base = await fixture(actions, org);
    const saved = { version: 1, event: base.event, actions, nextActionIndex, pauseReason: { code: 'ENTITLEMENT_REQUIRED', entitlementState: 'PAID_READ_ONLY_GRACE', readOnly: true, requiredFeature: 'workflows', reasonCode: 'WORKSPACE_READ_ONLY', pausedAt: new Date().toISOString() } };
    const execution = await prisma.workflowExecution.create({ data: { organizationId: org, workflowId: base.workflow.id, eventId: base.event.eventId, eventType: base.event.eventType, entityType: base.event.entityType, entityId: base.event.entityId, status: 'PAUSED_ENTITLEMENT', metadata: saved as Prisma.InputJsonValue } });
    return { ...base, execution };
  }

  beforeAll(async () => {
    const databaseUrl = new URL(process.env.DATABASE_URL!);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname)) throw new Error('Workflow integration tests require local PostgreSQL');
    if (!/test|ci/i.test(databaseUrl.pathname) || process.env.CONFIRM_DISPOSABLE_WORKFLOW_DB !== '1') throw new Error('Workflow integration tests require an explicitly confirmed disposable test database');
    await prisma.$connect();
    databaseConnected = true;
    const executePermission = await prisma.permission.findUnique({ where: { code: 'workflows.execute' }, select: { id: true } });
    if (!executePermission) throw new Error('The workflows.execute permission required by the migrated schema is missing');
    await prisma.$transaction(async (tx) => {
      await tx.role.create({ data: { id: roleId, name: roleName, displayName: 'Workflow integration test role' } });
      await tx.department.create({ data: { id: departmentId, name: 'Workflow integration test department', code: departmentCode } });
      await tx.user.create({ data: { id: userId, name: 'Workflow integration test user', email: userEmail, passwordHash: 'non-login-test-fixture', isActive: true, roleId, departmentId } });
      await tx.rolePermission.create({ data: { id: rolePermissionId, roleId, permissionId: executePermission.id } });
    });
    const plan = await prisma.platformPlan.create({ data: { slug: `workflow-test-${suffix}`, name: 'Workflow test', features: JSON.stringify(['workflows']) } });
    planId = plan.id;
    const organization = await prisma.organization.create({ data: { name: `Workflow test ${suffix}`, slug: `workflow-test-${suffix}` } });
    organizationId = organization.id;
    const other = await prisma.organization.create({ data: { name: `Workflow other ${suffix}`, slug: `workflow-other-${suffix}` } });
    otherOrganizationId = other.id;
    await prisma.organizationMember.createMany({ data: [{ organizationId, userId, roleId, status: 'ACTIVE' }, { organizationId: otherOrganizationId, userId, roleId, status: 'ACTIVE' }] });
    await prisma.platformSubscription.createMany({ data: [{ organizationId, planId, ...writableWindow() }, { organizationId: otherOrganizationId, planId, ...writableWindow() }] });
  });

  afterEach(async () => {
    setWorkflowExecutionTestHooksForTests(null);
    await setWritable();
  });

  afterAll(async () => {
    if (!databaseConnected) return;
    try {
      if (organizationId || otherOrganizationId) {
        const ids = [organizationId, otherOrganizationId].filter(Boolean);
        await prisma.auditLog.deleteMany({ where: { organizationId: { in: ids } } });
        await prisma.notification.deleteMany({ where: { organizationId: { in: ids } } });
        await prisma.crmTask.deleteMany({ where: { organizationId: { in: ids } } });
        await prisma.client.deleteMany({ where: { organizationId: { in: ids } } });
        await prisma.platformSubscription.deleteMany({ where: { organizationId: { in: ids } } });
        await prisma.organization.deleteMany({ where: { id: { in: ids } } });
      }
      if (planId) await prisma.platformPlan.deleteMany({ where: { id: planId, slug: `workflow-test-${suffix}` } });
    } finally {
      try {
        await prisma.rolePermission.deleteMany({ where: { id: rolePermissionId, roleId } });
        await prisma.user.deleteMany({ where: { id: userId, email: userEmail } });
        await prisma.department.deleteMany({ where: { id: departmentId, code: departmentCode } });
        await prisma.role.deleteMany({ where: { id: roleId, name: roleName } });
      } finally {
        await prisma.$disconnect();
      }
    }
  });

  it('keeps existing workflow behavior under a writable workflows entitlement', async () => {
    const item = await fixture([{ type: 'CREATE_TASK', title: `active-a-${suffix}` }, { type: 'CREATE_TASK', title: `active-b-${suffix}` }]);
    await WorkflowService.dispatch(item.event);
    expect(await prisma.crmTask.count({ where: { organizationId, title: { in: [`active-a-${suffix}`, `active-b-${suffix}`] } } })).toBe(2);
    const execution = await prisma.workflowExecution.findUniqueOrThrow({ where: { organizationId_workflowId_eventId: { organizationId, workflowId: item.workflow.id, eventId: item.event.eventId } } });
    expect(execution.status).toBe('COMPLETED');
    expect(execution.metadata).toMatchObject({ nextActionIndex: 2 });
  });

  it('fails closed for grace, missing subscription, and invalid plan data', async () => {
    await prisma.platformSubscription.update({ where: { organizationId }, data: { status: 'ACTIVE', endsAt: new Date(Date.now() - 1) } });
    const grace = await fixture([{ type: 'CREATE_TASK', title: `grace-${suffix}` }]);
    await WorkflowService.dispatch(grace.event);
    expect(await prisma.crmTask.count({ where: { organizationId, title: `grace-${suffix}` } })).toBe(0);
    expect((await prisma.workflowExecution.findFirstOrThrow({ where: { workflowId: grace.workflow.id } })).status).toBe('PAUSED_ENTITLEMENT');

    await prisma.platformSubscription.delete({ where: { organizationId } });
    const missing = await fixture([{ type: 'CREATE_TASK', title: `missing-${suffix}` }]);
    await WorkflowService.dispatch(missing.event);
    expect((await prisma.workflowExecution.findFirstOrThrow({ where: { workflowId: missing.workflow.id } })).status).toBe('PAUSED_ENTITLEMENT');

    await setWritable();
    await prisma.platformPlan.update({ where: { id: planId }, data: { features: 'not-json' } });
    const invalid = await fixture([{ type: 'CREATE_TASK', title: `invalid-${suffix}` }]);
    await WorkflowService.dispatch(invalid.event);
    expect((await prisma.workflowExecution.findFirstOrThrow({ where: { workflowId: invalid.workflow.id } })).status).toBe('PAUSED_ENTITLEMENT');
  });

  it('commits action one, then pauses before action two when entitlement expires', async () => {
    const firstTitle = `committed-${suffix}`, secondTitle = `resumed-${suffix}`;
    const item = await fixture([{ type: 'CREATE_TASK', title: firstTitle }, { type: 'CREATE_TASK', title: secondTitle }]);
    setWorkflowExecutionTestHooksForTests({
      afterActionCommitted: async context => {
        if (context.actionIndex !== 0) return;
        const execution = await prisma.workflowExecution.findUnique({ where: { id: context.executionId }, select: { workflowId: true } });
        if (execution?.workflowId === item.workflow.id) {
          await prisma.platformSubscription.update({ where: { organizationId }, data: { endsAt: new Date(Date.now() - 1) } });
        }
      },
    });

    await WorkflowService.dispatch(item.event);

    expect(await prisma.crmTask.count({ where: { organizationId, title: firstTitle } })).toBe(1);
    expect(await prisma.crmTask.count({ where: { organizationId, title: secondTitle } })).toBe(0);
    const paused = await prisma.workflowExecution.findUniqueOrThrow({ where: { organizationId_workflowId_eventId: { organizationId, workflowId: item.workflow.id, eventId: item.event.eventId } } });
    expect(paused.status).toBe('PAUSED_ENTITLEMENT');
    expect(paused.metadata).toMatchObject({ nextActionIndex: 1 });

    setWorkflowExecutionTestHooksForTests(null);
    await setWritable();
    expect(await WorkflowService.resume(session(), paused.id)).toMatchObject({ status: 'COMPLETED' });
    expect(await prisma.crmTask.count({ where: { organizationId, title: firstTitle } })).toBe(1);
    expect(await prisma.crmTask.count({ where: { organizationId, title: secondTitle } })).toBe(1);
  });

  it('rolls a business write back with checkpoint advancement after a deliberate exception', async () => {
    const title = `rolled-back-${suffix}`;
    const item = await fixture([{ type: 'CREATE_TASK', title }]);
    setWorkflowExecutionTestHooksForTests({ afterBusinessWrite: () => { throw new Error('deliberate post-write failure'); } });

    await WorkflowService.dispatch(item.event);

    expect(await prisma.crmTask.count({ where: { organizationId, title } })).toBe(0);
    const execution = await prisma.workflowExecution.findUniqueOrThrow({ where: { organizationId_workflowId_eventId: { organizationId, workflowId: item.workflow.id, eventId: item.event.eventId } } });
    expect(execution.status).toBe('FAILED');
    expect(execution.errorMessage).toContain('deliberate post-write failure');
    expect(execution.metadata).toMatchObject({ nextActionIndex: 0 });
  });

  it('allows only one concurrent resumer to confirm an action', async () => {
    const title = `concurrent-${suffix}`;
    const item = await checkpointFixture([{ type: 'CREATE_TASK', title }]);
    await Promise.all([WorkflowService.resume(session(), item.execution.id), WorkflowService.resume(session(), item.execution.id)]);
    expect(await prisma.crmTask.count({ where: { organizationId, title } })).toBe(1);
    expect((await prisma.workflowExecution.findUniqueOrThrow({ where: { id: item.execution.id } })).status).toBe('COMPLETED');
  });

  it('rejects a stale owner through WorkflowService after lease takeover', async () => {
    const title = `stale-${suffix}`;
    const item = await fixture([{ type: 'CREATE_TASK', title }]);
    let takeoverStarted = false;
    setWorkflowExecutionTestHooksForTests({
      beforeAction: async context => {
        if (takeoverStarted) return;
        takeoverStarted = true;
        await prisma.operationExecution.update({ where: { id: context.operationId }, data: { leaseExpiresAt: new Date(Date.now() - 60_000) } });
        await expect(WorkflowService.resume(session(), context.executionId)).resolves.toMatchObject({ status: 'COMPLETED' });
      },
    });

    await WorkflowService.dispatch(item.event);

    expect(await prisma.crmTask.count({ where: { organizationId, title } })).toBe(1);
    const execution = await prisma.workflowExecution.findUniqueOrThrow({ where: { organizationId_workflowId_eventId: { organizationId, workflowId: item.workflow.id, eventId: item.event.eventId } } });
    expect(execution.status).toBe('COMPLETED');
    expect((execution.metadata as Record<string, unknown>).nextActionIndex).toBe(1);
  });

  it('terminalizes legacy metadata without leaving a RUNNING execution', async () => {
    const item = await fixture([{ type: 'CREATE_TASK', title: `legacy-${suffix}` }]);
    const execution = await prisma.workflowExecution.create({ data: { organizationId, workflowId: item.workflow.id, eventId: item.event.eventId, eventType: item.event.eventType, entityType: item.event.entityType, entityId: item.event.entityId, status: 'RUNNING', metadata: { actorId: userId, depth: 0 } } });

    await expect(WorkflowService.resume(session(), execution.id)).resolves.toMatchObject({ status: 'NON_RESUMABLE' });

    expect(await prisma.workflowExecution.findUniqueOrThrow({ where: { id: execution.id } })).toMatchObject({ status: 'FAILED', errorMessage: 'Workflow execution has no safe resumable checkpoint' });
    expect(await prisma.operationExecution.findFirstOrThrow({ where: { organizationId, operationType: 'WORKFLOW', idempotencyKey: execution.id } })).toMatchObject({ status: 'FAILED', ownerToken: null, leaseExpiresAt: null });
    expect(await prisma.auditLog.count({ where: { organizationId, action: 'WORKFLOW_NON_RESUMABLE', metadata: { contains: execution.id } } })).toBe(1);
    expect(await prisma.crmTask.count({ where: { organizationId, title: `legacy-${suffix}` } })).toBe(0);
  });

  it('rejects a cross-tenant workflow relationship before a business write', async () => {
    const source = await fixture([{ type: 'CREATE_TASK', title: `cross-tenant-${suffix}` }]);
    const foreign = await fixture([{ type: 'CREATE_TASK', title: `foreign-${suffix}` }], otherOrganizationId);
    const execution = await prisma.workflowExecution.create({ data: { organizationId, workflowId: foreign.workflow.id, eventId: source.event.eventId, eventType: source.event.eventType, entityType: source.event.entityType, entityId: source.event.entityId, status: 'PAUSED_ENTITLEMENT', metadata: { version: 1, event: source.event, actions: [{ type: 'CREATE_TASK', title: `cross-tenant-${suffix}` }], nextActionIndex: 0 } } });

    await expect(WorkflowService.resume(session(), execution.id)).resolves.toMatchObject({ status: 'NON_RESUMABLE' });

    expect(await prisma.workflowExecution.findUniqueOrThrow({ where: { id: execution.id } })).toMatchObject({ status: 'FAILED' });
    expect(await prisma.crmTask.count({ where: { organizationId, title: `cross-tenant-${suffix}` } })).toBe(0);
  });

  it('rejects mismatched persisted event context before a business write', async () => {
    const title = `event-mismatch-${suffix}`;
    const item = await checkpointFixture([{ type: 'CREATE_TASK', title }]);
    await prisma.workflowExecution.update({ where: { id: item.execution.id }, data: { metadata: { version: 1, event: { ...item.event, entityId: `wrong-${item.client.id}` }, actions: [{ type: 'CREATE_TASK', title }], nextActionIndex: 0 } } });

    await expect(WorkflowService.resume(session(), item.execution.id)).resolves.toMatchObject({ status: 'NON_RESUMABLE' });

    expect(await prisma.workflowExecution.findUniqueOrThrow({ where: { id: item.execution.id } })).toMatchObject({ status: 'FAILED' });
    expect(await prisma.crmTask.count({ where: { organizationId, title } })).toBe(0);
  });

  it('does not allow a tenant-scoped caller to resume another tenant execution', async () => {
    const item = await checkpointFixture([{ type: 'CREATE_TASK', title: `other-${suffix}` }], 0, otherOrganizationId);
    await expect(WorkflowService.resume(session(), item.execution.id)).rejects.toThrow('Workflow execution not found');
    expect(await prisma.crmTask.count({ where: { organizationId: otherOrganizationId, title: `other-${suffix}` } })).toBe(0);
  });
});
