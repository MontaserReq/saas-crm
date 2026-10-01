import { describe, expect, it, vi } from 'vitest';
import { canAccessTicket } from '@/lib/permissions';
import { UserSession } from '@/types';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    ticket: { findFirst: vi.fn() },
    ticketAssignee: { findFirst: vi.fn() },
  },
}));

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));

const user: UserSession = {
  id: 'user-a', name: 'Tenant A User', email: 'a@example.test', role: 'MEMBER',
  roleDisplayName: 'Member', departmentId: 'dept-a', departmentName: 'A',
  organizationId: 'org-a', permissions: ['tickets.view_assigned'],
};

describe('tenant isolation access guards', () => {
  it('does not authorize a ticket from another organization', async () => {
    prismaMock.ticket.findFirst.mockResolvedValue({ createdById: 'user-a', organizationId: 'org-b' });
    prismaMock.ticketAssignee.findFirst.mockResolvedValue({ id: 'assignment-b' });

    await expect(canAccessTicket(user, 'ticket-b')).resolves.toBe(false);
    expect(prismaMock.ticket.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'ticket-b', organizationId: 'org-a' } }));
    expect(prismaMock.ticketAssignee.findFirst).not.toHaveBeenCalled();
  });

  it('allows a same-organization creator to access their ticket', async () => {
    prismaMock.ticket.findFirst.mockResolvedValue({ createdById: 'user-a', organizationId: 'org-a' });

    await expect(canAccessTicket(user, 'ticket-a')).resolves.toBe(true);
  });
});
