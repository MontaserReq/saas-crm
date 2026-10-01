import prisma from '../src/lib/db/prisma';
import { UserSession } from '../src/types';
import { ClientService } from '../src/server/services/ClientService';
import { LeadService } from '../src/server/services/LeadService';
import { ContactService } from '../src/server/services/ContactService';
import { ProposalService } from '../src/server/services/ProposalService';
import { CalendarService } from '../src/server/services/CalendarService';
import { TicketService } from '../src/server/services/TicketService';

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
  const schoolCountA = await prisma.school.count({ where: { organizationId: orgA.id } });
  const schoolCountB = await prisma.school.count({ where: { organizationId: orgB.id } });
  pass('migration.school_to_client.counts', await prisma.client.count({ where: { organizationId: orgA.id, type: 'SCHOOL' } }) >= schoolCountA && await prisma.client.count({ where: { organizationId: orgB.id, type: 'SCHOOL' } }) >= schoolCountB);
  const clientA = (await ClientService.list(a))[0]; const clientB = (await ClientService.list(b))[0];
  pass('client.list.isolated', (await ClientService.list(a)).every(x => x.organizationId === orgA.id) && (await ClientService.list(b)).every(x => x.organizationId === orgB.id));
  pass('client.read.own', !!(await ClientService.get(a, clientA.id))); pass('client.read.cross', !(await ClientService.get(a, clientB.id)));
  await denied('client.update.cross', () => ClientService.update(a, clientB.id, { name: 'cross' })); await denied('client.delete.cross', () => ClientService.delete(a, clientB.id));
  const newClient = await ClientService.create(a, { name: 'Generic Client A', type: 'COMPANY' }); pass('client.create.own', newClient.organizationId === orgA.id);
  const leadA = await LeadService.create(a, { name: 'Lead A', clientId: newClient.id }); const leadB = await LeadService.create(b, { name: 'Lead B', clientId: clientB.id });
  pass('lead.list.isolated', (await LeadService.list(a)).every(x => x.organizationId === orgA.id) && (await LeadService.list(b)).every(x => x.organizationId === orgB.id)); pass('lead.read.cross', !(await LeadService.get(a, leadB.id)));
  await denied('lead.create.cross-client', () => LeadService.create(a, { name: 'Cross Lead', clientId: clientB.id })); await denied('lead.update.cross', () => LeadService.update(a, leadB.id, { name: 'cross' })); await denied('lead.delete.cross', () => LeadService.delete(a, leadB.id));
  const contactA = await ContactService.create(a, { firstName: 'Contact A', clientId: newClient.id }); const contactB = await ContactService.create(b, { firstName: 'Contact B', clientId: clientB.id });
  pass('contact.list.isolated', (await ContactService.list(a)).every(x => x.organizationId === orgA.id) && (await ContactService.list(b)).every(x => x.organizationId === orgB.id)); pass('contact.read.cross', !(await ContactService.get(a, contactB.id)));
  await denied('contact.create.cross-client', () => ContactService.create(a, { firstName: 'Cross Contact', clientId: clientB.id })); await denied('contact.update.cross', () => ContactService.update(a, contactB.id, { firstName: 'cross' })); await denied('contact.delete.cross', () => ContactService.delete(a, contactB.id));
  await denied('proposal.create.cross-client', () => ProposalService.createProposal(a, { title: 'Cross', clientName: 'Cross', clientId: clientB.id }));
  await denied('calendar.create.cross-client', () => CalendarService.createEvent(a, { title: 'Cross', type: 'MEETING', startDate: new Date().toISOString(), clientId: clientB.id }));
  await denied('ticket.create.cross-client', () => TicketService.createTicket(a, { departmentId: deptA.id, subject: 'Cross', clientId: clientB.id }));
  const nulls = await Promise.all(['Client', 'Lead', 'Contact'].map(async table => { const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE "organizationId" IS NULL`); return [table, Number(rows[0].count)] as const; }));
  pass('generic.ownership.nulls', nulls.every(([, count]) => count === 0));
  console.log(JSON.stringify({ results, pass: Object.values(results).filter(x => x === 'PASS').length, fail: Object.values(results).filter(x => x === 'FAIL').length, nulls: Object.fromEntries(nulls) }));
}
main().finally(() => prisma.$disconnect());
