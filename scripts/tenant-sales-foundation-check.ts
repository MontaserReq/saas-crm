import prisma from '../src/lib/db/prisma';
import { UserSession } from '../src/types';
import { LeadService } from '../src/server/services/LeadService';
import { PipelineService } from '../src/server/services/PipelineService';
import { DealService } from '../src/server/services/DealService';
import { CrmTaskService } from '../src/server/services/CrmTaskService';

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
  const a = session(userA, orgA.id, deptA.id); const b = session(userB, orgB.id, deptB.id);
  const pipelineA = await PipelineService.ensureDefault(a); const pipelineB = await PipelineService.ensureDefault(b);
  const stageA = (await PipelineService.get(a, pipelineA!.id))!.stages[0]; const stageB = (await PipelineService.get(b, pipelineB!.id))!.stages[0];
  pass('pipeline.default.isolated', pipelineA!.organizationId === orgA.id && pipelineB!.organizationId === orgB.id && stageA.pipelineId === pipelineA!.id && stageB.pipelineId === pipelineB!.id);
  const clientA = (await prisma.client.findFirstOrThrow({ where: { organizationId: orgA.id, deletedAt: null } })); const clientB = (await prisma.client.findFirstOrThrow({ where: { organizationId: orgB.id, deletedAt: null } }));
  const contactA = await prisma.contact.create({ data: { organizationId: orgA.id, clientId: clientA.id, firstName: 'Sales A' } });
  const leadA = await LeadService.create(a, { name: 'Convertible A', companyName: `Conversion ${Date.now()}`, email: `conversion-${Date.now()}@example.test` });
  const converted = await LeadService.convert(a, leadA.id, { client: { name: `Converted ${Date.now()}`, type: 'COMPANY' }, contact: { firstName: 'Converted Contact' } });
  pass('lead.conversion.atomic.result', converted.lead.status === 'CONVERTED' && !!converted.clientId && !!converted.contactId);
  const convertedRow = await prisma.lead.findUniqueOrThrow({ where: { id: leadA.id } }); pass('lead.conversion.links', convertedRow.convertedClientId === converted.clientId && convertedRow.convertedContactId === converted.contactId);
  await denied('lead.conversion.repeat', () => LeadService.convert(a, leadA.id, { clientId: converted.clientId! }));
  const dealA = await DealService.create(a, { title: 'Deal A', pipelineId: pipelineA!.id, stageId: stageA.id, ownerId: userA.id, clientId: clientA.id, primaryContactId: contactA.id });
  const dealB = await DealService.create(b, { title: 'Deal B', pipelineId: pipelineB!.id, stageId: stageB.id, ownerId: userB.id, clientId: clientB.id });
  pass('deal.create.own', dealA!.organizationId === orgA.id); pass('deal.list.isolated', (await DealService.list(a)).every(x => x.organizationId === orgA.id) && (await DealService.list(b)).every(x => x.organizationId === orgB.id)); pass('deal.read.cross', !(await DealService.get(a, dealB!.id)));
  await denied('deal.cross.client', () => DealService.create(a, { title: 'x', pipelineId: pipelineA!.id, stageId: stageA.id, ownerId: userA.id, clientId: clientB.id }));
  await denied('deal.cross.contact', async () => DealService.create(a, { title: 'x', pipelineId: pipelineA!.id, stageId: stageA.id, ownerId: userA.id, primaryContactId: (await prisma.contact.create({ data: { organizationId: orgB.id, firstName: 'B' } })).id }));
  await denied('deal.cross.lead', async () => DealService.create(a, { title: 'x', pipelineId: pipelineA!.id, stageId: stageA.id, ownerId: userA.id, leadId: (await LeadService.create(b, { name: 'B Lead' })).id }));
  await denied('deal.cross.pipeline', () => DealService.create(a, { title: 'x', pipelineId: pipelineB!.id, stageId: stageB.id, ownerId: userA.id }));
  await denied('deal.cross.user', () => DealService.create(a, { title: 'x', pipelineId: pipelineA!.id, stageId: stageA.id, ownerId: userB.id }));
  await denied('deal.mismatched.stage', () => DealService.create(a, { title: 'x', pipelineId: pipelineA!.id, stageId: stageB.id, ownerId: userA.id }));
  const managedStage = await PipelineService.createStage(a, pipelineA!.id, { name: `Configured ${Date.now()}`, order: 100000 + Math.floor(Math.random() * 100000), probability: 60 });
  const renamedStageName = `Configured Stage ${Date.now()}`; const renamedStage = await PipelineService.updateStage(a, managedStage.id, { name: renamedStageName });
  pass('pipeline.stage.manage', renamedStage.name === renamedStageName); await PipelineService.deactivateStage(a, managedStage.id); pass('pipeline.stage.deactivate', !(await prisma.pipelineStage.findUniqueOrThrow({ where: { id: managedStage.id } })).isActive); await denied('pipeline.stage.deactivate.with-deal', () => PipelineService.deactivateStage(a, stageA.id));
  const stageTarget = (await PipelineService.get(a, pipelineA!.id))!.stages.find((s: any) => s.id !== stageA.id && s.isActive)!; const moved = await DealService.update(a, dealA!.id, { stageId: stageTarget.id }); pass('deal.stage.change', moved!.stageId === stageTarget.id && moved!.status === 'OPEN');
  const taskA = await CrmTaskService.create(a, { title: 'Task A', dealId: dealA!.id, clientId: clientA.id, assignedUserId: userA.id });
  pass('task.create.own', taskA.organizationId === orgA.id); pass('task.list.isolated', (await CrmTaskService.list(a)).every(x => x.organizationId === orgA.id) && (await CrmTaskService.list(b)).every(x => x.organizationId === orgB.id));
  await denied('task.cross.client', () => CrmTaskService.create(a, { title: 'x', clientId: clientB.id })); await denied('task.cross.deal', () => CrmTaskService.create(a, { title: 'x', dealId: dealB!.id })); await denied('task.cross.user', () => CrmTaskService.create(a, { title: 'x', assignedUserId: userB.id }));
  const completed = await CrmTaskService.update(a, taskA.id, { status: 'COMPLETED' }); pass('task.complete.history', completed.status === 'COMPLETED' && !!completed.completedAt);
  const nullCounts = await Promise.all(['Pipeline', 'PipelineStage', 'Deal', 'CrmTask'].map(async table => { const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE "organizationId" IS NULL`); return [table, Number(rows[0].count)] as const; }));
  console.log(JSON.stringify({ results, pass: Object.values(results).filter(x => x === 'PASS').length, fail: Object.values(results).filter(x => x === 'FAIL').length, nulls: Object.fromEntries(nullCounts) }));
}
main().finally(() => prisma.$disconnect());
