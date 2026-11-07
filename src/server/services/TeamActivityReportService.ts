import prisma from '@/lib/db/prisma';
import { requireOrganizationContext } from '@/lib/auth/organization';
import { UserSession } from '@/types';

export type TeamActivityReportInput = {
  date?: string;
  userId?: string;
  search?: string;
};

export type TeamActivityOperation = {
  id: string;
  kind: 'ticket' | 'school' | 'note' | 'communication' | 'assignment' | 'ticket_update';
  label: string;
  occurredAt: string;
  detail: string;
  ticketNumber?: string | null;
  ticketSubject?: string | null;
  schoolName?: string | null;
};

export type TeamActivityMember = {
  id: string;
  name: string;
  department: string;
  email: string;
  status: 'WORKED' | 'NO_ACTIVITY';
  stats: {
    ticketsCreated: number;
    schoolsAdded: number;
    notesAdded: number;
    communications: number;
    assignments: number;
    ticketUpdates: number;
    total: number;
  };
  operations: TeamActivityOperation[];
};

export type TeamActivityReport = {
  date: string;
  timezone: string;
  employeeId: string;
  search: string;
  members: TeamActivityMember[];
};

const TICKET_UPDATE_TYPES = [
  'SEEN',
  'ACCEPTED',
  'REJECTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CLOSED',
  'STATUS_CHANGED',
  'STATUS_UPDATED',
  'INFORMATION_UPDATE_REQUESTED',
  'INFORMATION_UPDATE_APPROVED',
  'INFORMATION_UPDATE_REJECTED',
  'RESUBMITTED',
] as const;

function partsFor(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)])) as Record<string, number>;
}

function plainDate(date: Date, timezone: string): string {
  const parts = partsFor(date, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function addOnePlainDay(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

/** Converts a wall-clock date in the organization timezone into a UTC instant. */
function zonedMidnight(value: string, timezone: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const zoned = partsFor(new Date(guess), timezone);
  const asUtc = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second);
  return new Date(guess - (asUtc - guess));
}

function validDate(value: string | undefined, timezone: string): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (candidate.getUTCFullYear() === year && candidate.getUTCMonth() + 1 === month && candidate.getUTCDate() === day) return value;
  }
  return plainDate(new Date(), timezone);
}

function short(value: string | null | undefined, length = 120): string {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  return normalized.length > length ? `${normalized.slice(0, length - 1)}…` : normalized;
}

function mapCounts(rows: Array<{ [key: string]: any }>, key: string): Map<string, number> {
  return new Map(rows.map((row) => [row[key], row._count?._all ?? Object.values(row._count ?? {})[0] ?? 0]));
}

export class TeamActivityReportService {
  static async get(user: UserSession, input: TeamActivityReportInput = {}): Promise<TeamActivityReport> {
    const context = await requireOrganizationContext(user);
    const date = validDate(input.date, context.timezone);
    const start = zonedMidnight(date, context.timezone);
    const end = zonedMidnight(addOnePlainDay(date), context.timezone);
    const baseDate = { gte: start, lt: end };

    const activeMembers = await prisma.user.findMany({
      where: {
        isActive: true,
        organizationMemberships: { some: { organizationId: context.id, status: 'ACTIVE' } },
        ...(input.userId ? { id: input.userId } : {}),
      },
      select: { id: true, name: true, email: true, department: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
    const memberIds = activeMembers.map((member) => member.id);

    if (memberIds.length === 0) return { date, timezone: context.timezone, employeeId: input.userId || '', search: input.search?.trim() || '', members: [] };

    const [ticketCounts, schoolCounts, noteCounts, communicationCounts, assignmentCounts, updateCounts, tickets, schools, notes, communications, assignments, updates] = await Promise.all([
      prisma.ticket.groupBy({ by: ['createdById'], where: { organizationId: context.id, createdById: { in: memberIds }, createdAt: baseDate }, _count: { _all: true } }),
      prisma.school.groupBy({ by: ['createdById'], where: { organizationId: context.id, createdById: { in: memberIds }, isDeleted: false, createdAt: baseDate }, _count: { _all: true } }),
      prisma.note.groupBy({ by: ['authorId'], where: { authorId: { in: memberIds }, createdAt: baseDate, ticket: { organizationId: context.id } }, _count: { _all: true } }),
      prisma.communicationAttempt.groupBy({ by: ['performedById'], where: { performedById: { in: memberIds }, createdAt: baseDate, ticket: { organizationId: context.id } }, _count: { _all: true } }),
      prisma.assignmentHistory.groupBy({ by: ['performedById'], where: { performedById: { in: memberIds }, createdAt: baseDate, ticket: { organizationId: context.id } }, _count: { _all: true } }),
      prisma.activityEvent.groupBy({ by: ['actorId'], where: { actorId: { in: memberIds }, organizationId: context.id, createdAt: baseDate, type: { in: [...TICKET_UPDATE_TYPES] } }, _count: { _all: true } }),
      prisma.ticket.findMany({ where: { organizationId: context.id, createdById: { in: memberIds }, createdAt: baseDate }, select: { id: true, createdById: true, ticketNumber: true, subject: true, createdAt: true, school: { select: { name: true } } } }),
      prisma.school.findMany({ where: { organizationId: context.id, createdById: { in: memberIds }, isDeleted: false, createdAt: baseDate }, select: { id: true, createdById: true, name: true, createdAt: true } }),
      prisma.note.findMany({ where: { authorId: { in: memberIds }, createdAt: baseDate, ticket: { organizationId: context.id } }, select: { id: true, authorId: true, content: true, createdAt: true, ticket: { select: { ticketNumber: true, subject: true, school: { select: { name: true } } } } } }),
      prisma.communicationAttempt.findMany({ where: { performedById: { in: memberIds }, createdAt: baseDate, ticket: { organizationId: context.id } }, select: { id: true, performedById: true, method: true, result: true, note: true, createdAt: true, ticket: { select: { ticketNumber: true, subject: true, school: { select: { name: true } } } } } }),
      prisma.assignmentHistory.findMany({ where: { performedById: { in: memberIds }, createdAt: baseDate, ticket: { organizationId: context.id } }, select: { id: true, performedById: true, action: true, reason: true, createdAt: true, ticket: { select: { ticketNumber: true, subject: true, school: { select: { name: true } } } }, toUser: { select: { name: true } } } }),
      prisma.activityEvent.findMany({ where: { actorId: { in: memberIds }, organizationId: context.id, createdAt: baseDate, type: { in: [...TICKET_UPDATE_TYPES] } }, select: { id: true, actorId: true, type: true, title: true, description: true, createdAt: true, ticket: { select: { ticketNumber: true, subject: true, school: { select: { name: true } } } } } }),
    ]);

    const ticketByUser = mapCounts(ticketCounts, 'createdById');
    const schoolByUser = mapCounts(schoolCounts, 'createdById');
    const noteByUser = mapCounts(noteCounts, 'authorId');
    const communicationByUser = mapCounts(communicationCounts, 'performedById');
    const assignmentByUser = mapCounts(assignmentCounts, 'performedById');
    const updateByUser = mapCounts(updateCounts, 'actorId');
    const operations = new Map<string, TeamActivityOperation[]>();
    for (const id of memberIds) operations.set(id, []);
    const add = (userId: string, operation: TeamActivityOperation) => operations.get(userId)?.push(operation);

    for (const item of tickets) add(item.createdById, { id: `ticket-${item.id}`, kind: 'ticket', label: 'إنشاء تذكرة', occurredAt: item.createdAt.toISOString(), detail: item.subject, ticketNumber: item.ticketNumber, ticketSubject: item.subject, schoolName: item.school?.name });
    for (const item of schools) add(item.createdById!, { id: `school-${item.id}`, kind: 'school', label: 'إضافة مدرسة', occurredAt: item.createdAt.toISOString(), detail: item.name, schoolName: item.name });
    for (const item of notes) add(item.authorId, { id: `note-${item.id}`, kind: 'note', label: 'إضافة ملاحظة', occurredAt: item.createdAt.toISOString(), detail: short(item.content), ticketNumber: item.ticket.ticketNumber, ticketSubject: item.ticket.subject, schoolName: item.ticket.school?.name });
    for (const item of communications) add(item.performedById, { id: `communication-${item.id}`, kind: 'communication', label: 'عملية تواصل', occurredAt: item.createdAt.toISOString(), detail: `${item.method} · ${item.result}${item.note ? ` · ${short(item.note, 80)}` : ''}`, ticketNumber: item.ticket.ticketNumber, ticketSubject: item.ticket.subject, schoolName: item.ticket.school?.name });
    for (const item of assignments) add(item.performedById, { id: `assignment-${item.id}`, kind: 'assignment', label: 'توزيع أو تحويل', occurredAt: item.createdAt.toISOString(), detail: `${item.action}${item.toUser?.name ? ` → ${item.toUser.name}` : ''}${item.reason ? ` · ${short(item.reason, 80)}` : ''}`, ticketNumber: item.ticket.ticketNumber, ticketSubject: item.ticket.subject, schoolName: item.ticket.school?.name });
    for (const item of updates) add(item.actorId, { id: `update-${item.id}`, kind: 'ticket_update', label: 'تحديث تذكرة', occurredAt: item.createdAt.toISOString(), detail: short(item.description || item.title), ticketNumber: item.ticket.ticketNumber, ticketSubject: item.ticket.subject, schoolName: item.ticket.school?.name });

    const search = input.search?.trim().toLocaleLowerCase() || '';
    const members = activeMembers.map((member) => {
      const memberOperations = (operations.get(member.id) || []).sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
      const stats = {
        ticketsCreated: ticketByUser.get(member.id) || 0,
        schoolsAdded: schoolByUser.get(member.id) || 0,
        notesAdded: noteByUser.get(member.id) || 0,
        communications: communicationByUser.get(member.id) || 0,
        assignments: assignmentByUser.get(member.id) || 0,
        ticketUpdates: updateByUser.get(member.id) || 0,
        total: (ticketByUser.get(member.id) || 0) + (schoolByUser.get(member.id) || 0) + (noteByUser.get(member.id) || 0) + (communicationByUser.get(member.id) || 0) + (assignmentByUser.get(member.id) || 0) + (updateByUser.get(member.id) || 0),
      };
      return { id: member.id, name: member.name, department: member.department.name, email: member.email, status: stats.total > 0 ? 'WORKED' as const : 'NO_ACTIVITY' as const, stats, operations: memberOperations };
    }).filter((member) => {
      if (!search) return true;
      const haystack = `${member.name} ${member.email} ${member.department} ${member.operations.map((operation) => `${operation.label} ${operation.detail} ${operation.ticketNumber || ''} ${operation.ticketSubject || ''} ${operation.schoolName || ''}`).join(' ')}`.toLocaleLowerCase();
      return haystack.includes(search);
    });

    return { date, timezone: context.timezone, employeeId: input.userId || '', search, members };
  }
}
