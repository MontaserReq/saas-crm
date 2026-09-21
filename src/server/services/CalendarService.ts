import prisma from '@/lib/db/prisma';
import { UserSession } from '@/types';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { AuditService } from './AuditService';

export const CALENDAR_EVENT_TYPES = [
  'MEETING',
  'CALL',
  'FOLLOW_UP',
  'CONTRACT_SIGNING',
  'APPOINTMENT',
  'SCHEDULED_TASK',
  // Legacy types kept for backwards compatibility
  'DUE_DATE',
  'TASK',
  'EVENT',
] as const;

export type CalendarEventType = typeof CALENDAR_EVENT_TYPES[number];

export interface CalendarEventInput {
  title: string;
  description?: string | null;
  type: CalendarEventType | string;
  startDate: string;
  endDate?: string | null;
  allDay?: boolean;
  location?: string | null;
  /** Legacy single userId - kept for backwards compat */
  userId?: string | null;
  /** New multi-assignee user IDs */
  assigneeIds?: string[];
  schoolId?: string | null;
  ticketId?: string | null;
}

/** Include shape used throughout list/get queries */
const eventInclude = {
  user: { select: { id: true, name: true, email: true, avatar: true } },
  assignees: {
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
  },
  createdBy: { select: { id: true, name: true } },
  school: { select: { id: true, name: true, city: true } },
  ticket: { select: { id: true, ticketNumber: true, subject: true } },
} as const;

export class CalendarService {
  static async getCalendarEvents(user: UserSession, filter?: any) {
    return CalendarService.listEvents(user, filter);
  }

  static async listEvents(
    user: UserSession,
    filter?: { startMonth?: string; type?: string; schoolId?: string; myEventsOnly?: boolean }
  ) {
    if (!hasPermission(user, PERMISSIONS.CALENDAR_VIEW))
      throw new Error('Forbidden: calendar.view permission required');
    const canViewAll = hasPermission(user, PERMISSIONS.CALENDAR_VIEW_ALL);

    const where: any = {};

    if (!canViewAll || filter?.myEventsOnly) {
      where.OR = [
        { userId: user.id },
        { createdById: user.id },
        { assignees: { some: { userId: user.id } } },
      ];
    }

    if (filter?.type && filter.type !== 'ALL') {
      where.type = filter.type;
    }

    if (filter?.schoolId && filter.schoolId !== 'ALL') {
      where.schoolId = filter.schoolId;
    }

    return prisma.calendarEvent.findMany({
      where,
      orderBy: { startDate: 'asc' },
      include: eventInclude,
    });
  }

  static async createEvent(user: UserSession, input: CalendarEventInput) {
    if (!hasPermission(user, PERMISSIONS.CALENDAR_CREATE))
      throw new Error('Forbidden: calendar.create permission required');
    if (!input.title || input.title.trim().length < 2)
      throw new Error('Event title is required');
    if (!input.startDate)
      throw new Error('Event start date is required');

    const startDate = new Date(input.startDate);
    const endDate = input.endDate ? new Date(input.endDate) : null;

    if (endDate && endDate < startDate) {
      throw new Error(
        'تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء. / End date must be on or after the start date.'
      );
    }

    const rawIds = new Set<string>();
    if (input.userId) rawIds.add(input.userId);
    if (input.assigneeIds?.length) input.assigneeIds.forEach((id) => rawIds.add(id));
    if (rawIds.size === 0) rawIds.add(user.id);
    const assigneeIds = Array.from(rawIds);
    const primaryUserId = assigneeIds[0];

    const event = await prisma.calendarEvent.create({
      data: {
        title: input.title.trim(),
        description: input.description?.trim() || null,
        type: input.type || 'MEETING',
        startDate,
        endDate,
        allDay: !!input.allDay,
        location: input.location?.trim() || null,
        userId: primaryUserId,
        createdById: user.id,
        schoolId: input.schoolId || null,
        ticketId: input.ticketId || null,
        assignees: {
          create: assigneeIds.map((uid) => ({ userId: uid })),
        },
      },
      include: eventInclude,
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'CALENDAR_EVENT_CREATED',
      entityType: 'CalendarEvent',
      entityId: event.id,
      metadata: { title: event.title, type: event.type, assigneeCount: assigneeIds.length },
    });

    return event;
  }

  static async updateEvent(user: UserSession, id: string, input: Partial<CalendarEventInput>) {
    if (!hasPermission(user, PERMISSIONS.CALENDAR_UPDATE))
      throw new Error('Forbidden: calendar.update permission required');
    const existing = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!existing) throw new Error('Event not found');

    const canEdit =
      hasPermission(user, PERMISSIONS.CALENDAR_VIEW_ALL) ||
      existing.createdById === user.id ||
      existing.userId === user.id;
    if (!canEdit) throw new Error('Forbidden: You do not have permission to edit this event');

    const startDate = input.startDate ? new Date(input.startDate) : existing.startDate;
    const endDate =
      input.endDate !== undefined
        ? input.endDate ? new Date(input.endDate) : null
        : existing.endDate;

    if (endDate && endDate < startDate) {
      throw new Error(
        'تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء. / End date must be on or after the start date.'
      );
    }

    const data: any = {};
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.description !== undefined) data.description = input.description?.trim() || null;
    if (input.type !== undefined) data.type = input.type;
    if (input.startDate !== undefined) data.startDate = startDate;
    if (input.endDate !== undefined) data.endDate = endDate;
    if (input.allDay !== undefined) data.allDay = !!input.allDay;
    if (input.location !== undefined) data.location = input.location?.trim() || null;
    if (input.schoolId !== undefined) data.schoolId = input.schoolId || null;
    if (input.ticketId !== undefined) data.ticketId = input.ticketId || null;

    const hasAssigneeUpdate = input.assigneeIds !== undefined || input.userId !== undefined;
    if (hasAssigneeUpdate) {
      const rawIds = new Set<string>();
      if (input.userId) rawIds.add(input.userId);
      if (input.assigneeIds?.length) input.assigneeIds.forEach((uid) => rawIds.add(uid));
      const assigneeIds = Array.from(rawIds);
      if (assigneeIds.length > 0) {
        data.userId = assigneeIds[0];
        data.assignees = {
          deleteMany: {},
          create: assigneeIds.map((uid) => ({ userId: uid })),
        };
      }
    }

    return prisma.calendarEvent.update({ where: { id }, data, include: eventInclude });
  }

  static async deleteEvent(user: UserSession, id: string) {
    if (!hasPermission(user, PERMISSIONS.CALENDAR_DELETE))
      throw new Error('Forbidden: calendar.delete permission required');
    const existing = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!existing) throw new Error('Event not found');

    const canDelete =
      hasPermission(user, PERMISSIONS.CALENDAR_VIEW_ALL) ||
      existing.createdById === user.id ||
      existing.userId === user.id;
    if (!canDelete) throw new Error('Forbidden: You do not have permission to delete this event');

    await prisma.calendarEvent.delete({ where: { id } });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'CALENDAR_EVENT_DELETED',
      entityType: 'CalendarEvent',
      entityId: id,
      metadata: { title: existing.title },
    });

    return { success: true };
  }
}
