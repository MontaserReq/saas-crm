import prisma from '@/lib/db/prisma';
import { UserSession } from '@/types';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { AuditService } from './AuditService';

export interface CalendarEventInput {
  title: string;
  description?: string | null;
  type: 'MEETING' | 'FOLLOW_UP' | 'DUE_DATE' | 'TASK' | 'EVENT';
  startDate: string;
  endDate?: string | null;
  allDay?: boolean;
  location?: string | null;
  userId?: string | null;
  schoolId?: string | null;
  ticketId?: string | null;
}

export class CalendarService {
  /**
   * Lists calendar events scoped to the user or globally for managers/admins.
   */
  static async getCalendarEvents(user: UserSession, filter?: any) { return CalendarService.listEvents(user, filter); }

  static async listEvents(
    user: UserSession,
    filter?: { startMonth?: string; type?: string; schoolId?: string; myEventsOnly?: boolean }
  ) {
    if (!hasPermission(user, PERMISSIONS.CALENDAR_VIEW)) throw new Error('Forbidden: calendar.view permission required');
    const canViewAll = hasPermission(user, PERMISSIONS.CALENDAR_VIEW_ALL);

    const where: any = {};

    if (!canViewAll || filter?.myEventsOnly) {
      where.OR = [
        { userId: user.id },
        { createdById: user.id },
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
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
        createdBy: { select: { id: true, name: true } },
        school: { select: { id: true, name: true, city: true } },
        ticket: { select: { id: true, ticketNumber: true, subject: true } },
      },
    });
  }

  /**
   * Creates a calendar event.
   */
  static async createEvent(user: UserSession, input: CalendarEventInput) {
    if (!hasPermission(user, PERMISSIONS.CALENDAR_CREATE)) throw new Error('Forbidden: calendar.create permission required');
    if (!input.title || input.title.trim().length < 2) {
      throw new Error('Event title is required');
    }
    if (!input.startDate) {
      throw new Error('Event start date is required');
    }

    const event = await prisma.calendarEvent.create({
      data: {
        title: input.title.trim(),
        description: input.description?.trim() || null,
        type: input.type || 'EVENT',
        startDate: new Date(input.startDate),
        endDate: input.endDate ? new Date(input.endDate) : null,
        allDay: !!input.allDay,
        location: input.location?.trim() || null,
        userId: input.userId || user.id,
        createdById: user.id,
        schoolId: input.schoolId || null,
        ticketId: input.ticketId || null,
      },
      include: {
        user: { select: { id: true, name: true } },
        school: { select: { id: true, name: true } },
      },
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'CALENDAR_EVENT_CREATED',
      entityType: 'CalendarEvent',
      entityId: event.id,
      metadata: { title: event.title, type: event.type },
    });

    return event;
  }

  /**
   * Updates a calendar event.
   */
  static async updateEvent(user: UserSession, id: string, input: Partial<CalendarEventInput>) {
    if (!hasPermission(user, PERMISSIONS.CALENDAR_UPDATE)) throw new Error('Forbidden: calendar.update permission required');
    const existing = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!existing) throw new Error('Event not found');

    const canEdit =
      hasPermission(user, PERMISSIONS.CALENDAR_VIEW_ALL) ||
      existing.createdById === user.id ||
      existing.userId === user.id;

    if (!canEdit) {
      throw new Error('Forbidden: You do not have permission to edit this event');
    }

    const data: any = {};
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.description !== undefined) data.description = input.description?.trim() || null;
    if (input.type !== undefined) data.type = input.type;
    if (input.startDate !== undefined) data.startDate = new Date(input.startDate);
    if (input.endDate !== undefined) data.endDate = input.endDate ? new Date(input.endDate) : null;
    if (input.allDay !== undefined) data.allDay = !!input.allDay;
    if (input.location !== undefined) data.location = input.location?.trim() || null;
    if (input.userId !== undefined) data.userId = input.userId || null;
    if (input.schoolId !== undefined) data.schoolId = input.schoolId || null;
    if (input.ticketId !== undefined) data.ticketId = input.ticketId || null;

    const updated = await prisma.calendarEvent.update({
      where: { id },
      data,
    });

    return updated;
  }

  /**
   * Deletes a calendar event.
   */
  static async deleteEvent(user: UserSession, id: string) {
    if (!hasPermission(user, PERMISSIONS.CALENDAR_DELETE)) throw new Error('Forbidden: calendar.delete permission required');
    const existing = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!existing) throw new Error('Event not found');

    const canDelete =
      hasPermission(user, PERMISSIONS.CALENDAR_VIEW_ALL) ||
      existing.createdById === user.id ||
      existing.userId === user.id;

    if (!canDelete) {
      throw new Error('Forbidden: You do not have permission to delete this event');
    }

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
