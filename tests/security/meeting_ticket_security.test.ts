import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserSession } from '@/types';

const { prismaMock } = vi.hoisted(() => {
  const prismaMock: any = {
    ticket: { findUnique: vi.fn() },
    ticketAssignee: { findFirst: vi.fn() },
    attachment: { findUnique: vi.fn() },
    note: { create: vi.fn() },
    activityEvent: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  prismaMock.$transaction = vi.fn(async (fn: any) => fn(prismaMock));
  return { prismaMock };
});

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let currentUser: UserSession | null = null;
vi.mock('@/lib/auth/session', () => ({
  requireAuth: async () => {
    if (!currentUser) throw new Error('Unauthorized');
    return currentUser;
  },
}));

import { canAccessTicket, canAccessAttachment } from '@/lib/permissions';
import { addNoteAction } from '@/server/actions/tickets';

function makeUser(overrides: Partial<UserSession> = {}): UserSession {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'user@codeline.jo',
    role: 'MEMBER',
    roleDisplayName: 'Member',
    departmentId: 'dept-1',
    departmentName: 'Dept',
    permissions: ['tickets.add_note', 'attachments.upload'],
    ...overrides,
  };
}

const CREATOR_ID = 'meeting-creator';
const OTHER_USER_ID = 'unrelated-user';
const MEETING_TICKET_ID = 'meeting-ticket-1';

describe('Meeting Minutes ticket — access control (IDOR)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = null;
  });

  it('the creator of a meeting ticket can access it', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue({ createdById: CREATOR_ID });
    prismaMock.ticketAssignee.findFirst.mockResolvedValue(null);
    const creator = makeUser({ id: CREATOR_ID, permissions: [] });
    const allowed = await canAccessTicket(creator, MEETING_TICKET_ID);
    expect(allowed).toBe(true);
  });

  it('an unrelated user (guessing the ticket ID) cannot access another user\'s meeting ticket', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue({ createdById: CREATOR_ID });
    prismaMock.ticketAssignee.findFirst.mockResolvedValue(null);
    const attacker = makeUser({ id: OTHER_USER_ID, permissions: [] });
    const allowed = await canAccessTicket(attacker, MEETING_TICKET_ID);
    expect(allowed).toBe(false);
  });

  it('a user with tickets.view_all (e.g. ADMIN) can access any meeting ticket regardless of ownership', async () => {
    const admin = makeUser({ id: 'admin-1', role: 'ADMIN', permissions: ['tickets.view_all'] });
    const allowed = await canAccessTicket(admin, MEETING_TICKET_ID);
    expect(allowed).toBe(true);
    // Short-circuits on permission — never needs to hit the DB for this check.
    expect(prismaMock.ticket.findUnique).not.toHaveBeenCalled();
  });

  it('an unauthorized user cannot download a meeting minutes attachment by guessing its ID', async () => {
    prismaMock.attachment.findUnique.mockResolvedValue({
      id: 'att-1',
      ticketId: MEETING_TICKET_ID,
      noteId: 'note-1',
      note: { ticketId: MEETING_TICKET_ID },
    });
    prismaMock.ticket.findUnique.mockResolvedValue({ createdById: CREATOR_ID });
    prismaMock.ticketAssignee.findFirst.mockResolvedValue(null);

    const attacker = makeUser({ id: OTHER_USER_ID, permissions: [] });
    const allowed = await canAccessAttachment(attacker, 'att-1');
    expect(allowed).toBe(false);
  });

  it('the ticket creator can download a meeting minutes attachment', async () => {
    prismaMock.attachment.findUnique.mockResolvedValue({
      id: 'att-1',
      ticketId: MEETING_TICKET_ID,
      noteId: 'note-1',
      note: { ticketId: MEETING_TICKET_ID },
    });
    prismaMock.ticket.findUnique.mockResolvedValue({ createdById: CREATOR_ID });
    prismaMock.ticketAssignee.findFirst.mockResolvedValue(null);

    const creator = makeUser({ id: CREATOR_ID, permissions: [] });
    const allowed = await canAccessAttachment(creator, 'att-1');
    expect(allowed).toBe(true);
  });
});

describe('Meeting attachment upload — server-side file validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = makeUser();
  });

  function fileWith(name: string, type: string, size: number) {
    return new File([new Uint8Array(size)], name, { type });
  }

  it('rejects an executable disguised with an allowed-looking name but disallowed extension', async () => {
    const formData = new FormData();
    formData.append('ticketId', MEETING_TICKET_ID);
    formData.append('content', 'Meeting minutes attached.');
    formData.append('attachments', fileWith('minutes.exe', 'application/x-msdownload', 1024));

    const res = await addNoteAction(formData);
    expect(res.success).toBe(false);
    expect(prismaMock.note.create).not.toHaveBeenCalled();
  });

  it('rejects a file exceeding the 10MB size limit', async () => {
    const formData = new FormData();
    formData.append('ticketId', MEETING_TICKET_ID);
    formData.append('content', 'Meeting minutes attached.');
    formData.append('attachments', fileWith('minutes.pdf', 'application/pdf', 11 * 1024 * 1024));

    const res = await addNoteAction(formData);
    expect(res.success).toBe(false);
    expect(prismaMock.note.create).not.toHaveBeenCalled();
  });

  it('requires attachments.upload permission to attach a file at all', async () => {
    currentUser = makeUser({ permissions: ['tickets.add_note'] });
    const formData = new FormData();
    formData.append('ticketId', MEETING_TICKET_ID);
    formData.append('content', 'Meeting minutes attached.');
    formData.append('attachments', fileWith('minutes.pdf', 'application/pdf', 1024));

    const res = await addNoteAction(formData);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/attachment upload permission required/i);
  });
});
