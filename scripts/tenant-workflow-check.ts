import prisma from '../src/lib/db/prisma';
import { UserSession } from '../src/types';
import { WorkflowService } from '../src/server/services/WorkflowService';
import { LeadService } from '../src/server/services/LeadService';

const results: Record<string, string> = {};
const pass = (name: string, value: boolean) => { results[name] = value ? 'PASS' : 'FAIL'; };
async function denied(name: string, action: () => Promise<unknown>) { try { await action(); results[name] = 'FAIL'; } catch { results[name] = 'PASS'; } }
async function main() {
  const [orgA, orgB, deptA, deptB, userA, userB] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: 'tenant-org-a' } }), prisma.organization.findUniqueOrThrow({ where: { id: 'tenant-org-b' } }),
    prisma.department.findUniqueOrThrow({ where: { id: 'tenant-dept-a' } }), prisma.department.findUniqueOrThrow({ where: { id: 'tenant-dept-b' } }),
    prisma.user.findUniqueOrThrow({ where: { id: 'tenant-user-a' } }), prisma.user.findUniqueOrThrow({ where: { id: 'tenant-user-b' } }),
  ]);
  const session = (u: typeof userA, organizationId: string, departmentId: string): UserSession => ({ id: u.id, name: u.name, email: u.email, role: 'SUPER_ADMIN', roleDisplayName: 'Super Admin', departmentId, departmentName: departmentId === deptA.id ? deptA.name : deptB.name, organizationId, permissions: [] });
  const a = session(userA, orgA.id, deptA.id); const b = session(userB, orgB.id, deptB.id); const suffix = Date.now().toString();
  const workflow = await WorkflowService.create(a, { name: `Qualified lead follow-up ${suffix}`, entityType: 'LEAD', triggerType: 'LEAD_STATUS_CHANGED', conditions: { logic: 'ALL', conditions: [{ field: 'status', operator: 'equals', value: 'QUALIFIED' }] }, actions: [{ type: 'CREATE_TASK', title: 'Follow up', dueInDays: 2 }] });
  pass('workflow.list.isolated', !(await WorkflowService.list(b)).some(x => x.id === workflow.id));
  await denied('workflow.cross_org_archive', () => WorkflowService.archive(b, workflow.id));
  await denied('workflow.invalid_operator', () => WorkflowService.create(a, { name: `Bad ${suffix}`, entityType: 'LEAD', triggerType: 'LEAD_STATUS_CHANGED', conditions: { conditions: [{ field: 'status', operator: 'eval', value: 'x' }] }, actions: [{ type: 'CREATE_TASK' }] }));
  await WorkflowService.setActive(a, workflow.id, true);
  const lead = await LeadService.create(a, { name: `Workflow lead ${suffix}` });
  await LeadService.update(a, lead.id, { status: 'QUALIFIED' });
  const eventId = `workflow-check-${suffix}`;
  await WorkflowService.dispatch({ eventId, organizationId: orgA.id, entityType: 'LEAD', entityId: lead.id, eventType: 'LEAD_STATUS_CHANGED', actorId: userA.id });
  await WorkflowService.dispatch({ eventId, organizationId: orgA.id, entityType: 'LEAD', entityId: lead.id, eventType: 'LEAD_STATUS_CHANGED', actorId: userA.id });
  const executions = await prisma.workflowExecution.count({ where: { organizationId: orgA.id, workflowId: workflow.id, eventId } }); pass('workflow.idempotency', executions === 1);
  pass('workflow.execution_tenant_scope', (await WorkflowService.executions(a, workflow.id)).every(x => x.organizationId === orgA.id));
  const nulls = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>('SELECT COUNT(*)::bigint AS count FROM "Workflow" WHERE "organizationId" IS NULL'); pass('workflow.ownership_nulls', Number(nulls[0].count) === 0);
  const integrity = await prisma.$queryRawUnsafe<Array<{ workflow_orphans: bigint; execution_orphans: bigint; execution_mismatches: bigint }>>('SELECT (SELECT COUNT(*) FROM "Workflow" w LEFT JOIN "Organization" o ON o."id"=w."organizationId" WHERE o."id" IS NULL) AS workflow_orphans, (SELECT COUNT(*) FROM "WorkflowExecution" e LEFT JOIN "Organization" o ON o."id"=e."organizationId" WHERE o."id" IS NULL) AS execution_orphans, (SELECT COUNT(*) FROM "WorkflowExecution" e JOIN "Workflow" w ON w."id"=e."workflowId" WHERE e."organizationId"<>w."organizationId") AS execution_mismatches');
  pass('workflow.execution_orphans', Number(integrity[0].workflow_orphans) === 0 && Number(integrity[0].execution_orphans) === 0 && Number(integrity[0].execution_mismatches) === 0);
  console.log(JSON.stringify({ results, pass: Object.values(results).filter(x => x === 'PASS').length, fail: Object.values(results).filter(x => x === 'FAIL').length }));
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
