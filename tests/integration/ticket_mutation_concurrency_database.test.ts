import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadEnvConfig } from '@next/env';
import { randomUUID } from 'node:crypto';
import prisma from '@/lib/db/prisma';
import { TicketService } from '@/server/services/TicketService';
import type { UserSession } from '@/types';

const run = process.env.RUN_TICKET_MUTATION_DB === '1';
if (run) loadEnvConfig(process.cwd());
const suffix = randomUUID();
let organizationId = '';
let departmentId = '';
let ticketId = '';
let actorId = '';
let targetId = '';
let actor: UserSession;

describe.skipIf(!run)('PostgreSQL ticket mutation serialization', () => {
  beforeAll(async () => {
    const databaseUrl = new URL(process.env.DATABASE_URL!);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname)) throw new Error('Integration tests require a local PostgreSQL database');
    const role = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
    const organization = await prisma.organization.create({ data: { name: `Ticket concurrency ${suffix}`, slug: `ticket-concurrency-${suffix}` } });
    organizationId = organization.id;
    const department = await prisma.department.create({ data: { organizationId, name: 'QA', code: `TICKET_QA_${suffix}` } });
    departmentId = department.id;
    const createUser = async (label: string) => prisma.user.create({
      data: {
        name: `Ticket ${label}`,
        email: `ticket-${suffix}-${label}@example.test`,
        passwordHash: 'not-for-login',
        roleId: role.id,
        departmentId,
        organizationMemberships: { create: { organizationId, roleId: role.id, status: 'ACTIVE' } },
      },
    });
    const [user, target] = await Promise.all([createUser('actor'), createUser('target')]);
    actorId = user.id;
    targetId = target.id;
    actor = {
      id: user.id, name: user.name, email: user.email, role: 'ADMIN', roleDisplayName: 'Admin',
      departmentId, departmentName: 'QA', organizationId,
      permissions: ['tickets.accept', 'tickets.reject', 'tickets.transfer', 'tickets.complete', 'tickets.close', 'tickets.add_note'],
    };
    const ticket = await prisma.ticket.create({
      data: { organizationId, ticketNumber: `QA-${suffix}`, departmentId, subject: 'Concurrency fixture', status: 'PENDING', createdById: actorId },
    });
    ticketId = ticket.id;
    await prisma.ticketAssignee.create({ data: { ticketId, userId: actorId, isCurrent: true, role: 'ASSIGNEE' } });
  }, 30_000);

  beforeEach(async () => {
    await prisma.assignmentHistory.deleteMany({ where: { ticketId } });
    await prisma.note.deleteMany({ where: { ticketId } });
    await prisma.activityEvent.deleteMany({ where: { ticketId } });
    await prisma.notification.deleteMany({ where: { organizationId } });
    await prisma.auditLog.deleteMany({ where: { organizationId } });
    await prisma.ticketAssignee.deleteMany({ where: { ticketId } });
    await prisma.ticketAssignee.create({ data: { ticketId, userId: actorId, isCurrent: true, role: 'ASSIGNEE' } });
    await prisma.ticket.update({ where: { id: ticketId }, data: { status: 'PENDING', rejectionReason: null } });
  });

  afterAll(async () => {
    if (organizationId) {
      await prisma.auditLog.deleteMany({ where: { organizationId } });
      await prisma.notification.deleteMany({ where: { organizationId } });
      if (ticketId) await prisma.ticket.deleteMany({ where: { id: ticketId, organizationId } });
      await prisma.organizationMember.deleteMany({ where: { organizationId } });
      await prisma.user.deleteMany({ where: { id: { in: [actorId, targetId].filter(Boolean) } } });
      await prisma.department.deleteMany({ where: { id: departmentId, organizationId } });
      await prisma.organization.deleteMany({ where: { id: organizationId } });
    }
    await prisma.$disconnect();
  }, 30_000);

  it('allows only one of two incompatible transitions to commit', async () => {
    const results = await Promise.allSettled([
      TicketService.acceptTicket(actor, ticketId),
      TicketService.rejectTicket(actor, ticketId, 'Synthetic rejection reason'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).status).toMatch(/^(ACCEPTED|REJECTED)$/);
    expect(await prisma.ticketAssignee.count({ where: { ticketId, isCurrent: true, userId: actorId } })).toBe(1);
  });

  it('prevents a stale assignee from mutating after reassignment', async () => {
    await prisma.ticket.update({ where: { id: ticketId }, data: { status: 'ACCEPTED' } });
    await TicketService.transferTicket(actor, ticketId, targetId, 'Concurrency handoff');
    await expect(TicketService.updateStatus(actor, ticketId, 'IN_PROGRESS')).rejects.toThrow(/no longer an active assignee/i);
    expect(await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).toMatchObject({ status: 'PENDING' });
    expect(await prisma.ticketAssignee.count({ where: { ticketId, userId: targetId, isCurrent: true, role: 'ASSIGNEE' } })).toBe(1);
    expect(await prisma.assignmentHistory.count({ where: { ticketId, action: 'TRANSFER', toUserId: targetId } })).toBe(1);
  });
});
