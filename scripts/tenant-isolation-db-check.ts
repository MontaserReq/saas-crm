import { PrismaClient } from '@prisma/client';
import { canAccessTicket } from '../src/lib/permissions';

const prisma = new PrismaClient();

async function main() {
  const orgA = await prisma.organization.upsert({ where: { id: 'tenant-org-a' }, update: {}, create: { id: 'tenant-org-a', name: 'Org A', slug: 'tenant-org-a' } });
  const orgB = await prisma.organization.upsert({ where: { id: 'tenant-org-b' }, update: {}, create: { id: 'tenant-org-b', name: 'Org B', slug: 'tenant-org-b' } });
  const role = await prisma.role.upsert({ where: { name: 'TENANT_TEST_ADMIN' }, update: {}, create: { id: 'tenant-role-admin', name: 'TENANT_TEST_ADMIN', displayName: 'Tenant Test Admin', isSystem: false } });
  const deptA = await prisma.department.upsert({ where: { id: 'tenant-dept-a' }, update: {}, create: { id: 'tenant-dept-a', organizationId: orgA.id, name: 'Dept A', code: 'TENANT_A' } });
  const deptB = await prisma.department.upsert({ where: { id: 'tenant-dept-b' }, update: {}, create: { id: 'tenant-dept-b', organizationId: orgB.id, name: 'Dept B', code: 'TENANT_B' } });
  const userA = await prisma.user.upsert({ where: { id: 'tenant-user-a' }, update: {}, create: { id: 'tenant-user-a', name: 'User A', email: 'tenant-a@example.test', passwordHash: 'test-only', roleId: role.id, departmentId: deptA.id } });
  const userB = await prisma.user.upsert({ where: { id: 'tenant-user-b' }, update: {}, create: { id: 'tenant-user-b', name: 'User B', email: 'tenant-b@example.test', passwordHash: 'test-only', roleId: role.id, departmentId: deptB.id } });
  for (const [organizationId, userId] of [[orgA.id, userA.id], [orgB.id, userB.id]] as const) {
    await prisma.organizationMember.upsert({ where: { organizationId_userId: { organizationId, userId } }, update: { status: 'ACTIVE' }, create: { organizationId, userId, roleId: role.id, status: 'ACTIVE' } });
  }
  await prisma.team.upsert({ where: { id: 'tenant-team-a' }, update: {}, create: { id: 'tenant-team-a', organizationId: orgA.id, name: 'Team A' } });
  await prisma.team.upsert({ where: { id: 'tenant-team-b' }, update: {}, create: { id: 'tenant-team-b', organizationId: orgB.id, name: 'Team B' } });
  await prisma.school.upsert({ where: { id: 'tenant-school-a' }, update: {}, create: { id: 'tenant-school-a', organizationId: orgA.id, name: 'School A', city: 'Amman', createdById: userA.id } });
  await prisma.school.upsert({ where: { id: 'tenant-school-b' }, update: {}, create: { id: 'tenant-school-b', organizationId: orgB.id, name: 'School B', city: 'Amman', createdById: userB.id } });
  await prisma.school.update({ where: { id: 'tenant-school-a' }, data: { isPublic: false } });
  await prisma.school.update({ where: { id: 'tenant-school-b' }, data: { isPublic: false } });
  await prisma.school.upsert({ where: { id: 'tenant-public-school-a' }, update: { isPublic: true, organizationId: orgA.id }, create: { id: 'tenant-public-school-a', organizationId: orgA.id, name: 'Public School A', city: 'Amman', createdById: userA.id, isPublic: true, publicDescription: 'Public A' } });
  await prisma.school.upsert({ where: { id: 'tenant-public-school-b' }, update: { isPublic: true, organizationId: orgB.id }, create: { id: 'tenant-public-school-b', organizationId: orgB.id, name: 'Public School B', city: 'Amman', createdById: userB.id, isPublic: true, publicDescription: 'Public B' } });
  await prisma.ticket.upsert({ where: { id: 'tenant-ticket-a' }, update: {}, create: { id: 'tenant-ticket-a', organizationId: orgA.id, ticketNumber: 'TENANT-A', departmentId: deptA.id, schoolId: 'tenant-school-a', subject: 'Ticket A', createdById: userA.id } });
  await prisma.ticket.upsert({ where: { id: 'tenant-ticket-b' }, update: {}, create: { id: 'tenant-ticket-b', organizationId: orgB.id, ticketNumber: 'TENANT-B', departmentId: deptB.id, schoolId: 'tenant-school-b', subject: 'Ticket B', createdById: userB.id } });
  await prisma.proposal.upsert({ where: { id: 'tenant-proposal-a' }, update: {}, create: { id: 'tenant-proposal-a', organizationId: orgA.id, title: 'Proposal A', clientName: 'Client A', schoolId: 'tenant-school-a', createdById: userA.id } });
  await prisma.proposal.upsert({ where: { id: 'tenant-proposal-b' }, update: {}, create: { id: 'tenant-proposal-b', organizationId: orgB.id, title: 'Proposal B', clientName: 'Client B', schoolId: 'tenant-school-b', createdById: userB.id } });
  await prisma.calendarEvent.upsert({ where: { id: 'tenant-event-a' }, update: {}, create: { id: 'tenant-event-a', organizationId: orgA.id, title: 'Event A', startDate: new Date('2026-09-30T10:00:00Z'), createdById: userA.id, schoolId: 'tenant-school-a' } });
  await prisma.calendarEvent.upsert({ where: { id: 'tenant-event-b' }, update: {}, create: { id: 'tenant-event-b', organizationId: orgB.id, title: 'Event B', startDate: new Date('2026-09-30T10:00:00Z'), createdById: userB.id, schoolId: 'tenant-school-b' } });
  await prisma.attachment.upsert({ where: { id: 'tenant-attachment-a' }, update: {}, create: { id: 'tenant-attachment-a', organizationId: orgA.id, ticketId: 'tenant-ticket-a', originalName: 'a.txt', mimeType: 'text/plain', size: 1, storageKey: 'tenant-org-a/tickets/a.txt', uploadedById: userA.id } });
  await prisma.attachment.upsert({ where: { id: 'tenant-attachment-b' }, update: {}, create: { id: 'tenant-attachment-b', organizationId: orgB.id, ticketId: 'tenant-ticket-b', originalName: 'b.txt', mimeType: 'text/plain', size: 1, storageKey: 'tenant-org-b/tickets/b.txt', uploadedById: userB.id } });

  const tenantTables = ['Department', 'School', 'SchoolResearchJob', 'SchoolAssignment', 'TaskType', 'Ticket', 'TicketApprovalRequest', 'SchoolApprovalRequest', 'ChatConversation', 'Attachment', 'Notification', 'AuditLog', 'ActivityEvent', 'Todo', 'Message', 'MessageAttachment', 'CalendarEvent', 'MessageTemplate', 'ProposalTemplate', 'Proposal'];
  const nullCounts = Object.fromEntries(await Promise.all(tenantTables.map(async (table) => {
    const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE "organizationId" IS NULL`);
    return [table, Number(rows[0].count)];
  })));
  const aCounts = await Promise.all([
    prisma.school.count({ where: { organizationId: orgA.id } }), prisma.ticket.count({ where: { organizationId: orgA.id } }),
    prisma.proposal.count({ where: { organizationId: orgA.id } }), prisma.calendarEvent.count({ where: { organizationId: orgA.id } }),
    prisma.attachment.count({ where: { organizationId: orgA.id } }),
  ]);
  const fkOrphans = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "Ticket" t LEFT JOIN "Organization" o ON o.id = t."organizationId" WHERE t."organizationId" IS NOT NULL AND o.id IS NULL`;
  const publicSearchIds = (await prisma.school.findMany({ where: { isPublic: true, isDeleted: false, OR: [{ name: { contains: 'Public School', mode: 'insensitive' } }, { city: { contains: 'Public School', mode: 'insensitive' } }, { publicDescription: { contains: 'Public School', mode: 'insensitive' } }] }, select: { id: true }, orderBy: { name: 'asc' } })).map((row) => row.id);
  const privateSchoolAVisible = (await prisma.school.findMany({ where: { isPublic: true, isDeleted: false, OR: [{ name: { contains: 'School A', mode: 'insensitive' } }, { city: { contains: 'School A', mode: 'insensitive' } }, { publicDescription: { contains: 'School A', mode: 'insensitive' } }] }, select: { id: true } })).some((row) => row.id === 'tenant-school-a');
  let deleteBlocked = false;
  try { await prisma.organization.delete({ where: { id: orgA.id } }); } catch { deleteBlocked = true; }
  const sessionA: any = { id: userA.id, name: userA.name, email: userA.email, role: 'MEMBER', roleDisplayName: 'Tenant Test Admin', departmentId: deptA.id, departmentName: deptA.name, organizationId: orgA.id, permissions: ['tickets.view_assigned'] };
  const idor = { ticketAFromA: await canAccessTicket(sessionA, 'tenant-ticket-a'), ticketBFromA: await canAccessTicket(sessionA, 'tenant-ticket-b') };
  console.log(JSON.stringify({ organizations: [orgA.id, orgB.id], nullCounts, orgACounts: aCounts, ticketOrganizationOrphans: Number(fkOrphans[0].count), organizationDeleteBlocked: deleteBlocked, publicSearch: { publicSearchIds, privateSchoolAVisible }, idor }));
}

main().finally(() => prisma.$disconnect());
