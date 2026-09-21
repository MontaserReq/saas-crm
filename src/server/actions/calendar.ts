'use server';

import { requireAuth } from '@/lib/auth/session';
import { CalendarService } from '@/server/services/CalendarService';
import { revalidatePath } from 'next/cache';

export async function getCalendarEventsAction(filter?: {
  startMonth?: string;
  type?: string;
  schoolId?: string;
  myEventsOnly?: boolean;
}) {
  try {
    const user = await requireAuth();
    const events = await CalendarService.listEvents(user, filter);
    return { success: true, events };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch calendar events' };
  }
}

export async function createCalendarEventAction(input: any) {
  try {
    const user = await requireAuth();
    // Support assigneeIds array as well as legacy single assignedToUserId / userId
    const rawAssigneeIds = Array.isArray(input.assigneeIds)
      ? input.assigneeIds
      : input.assignedToUserId
      ? [input.assignedToUserId]
      : input.userId
      ? [input.userId]
      : [user.id];

    const mapped = {
      title: input.title,
      description: input.description,
      type: input.type || input.eventType || 'MEETING',
      startDate: input.startDate,
      endDate: input.endDate,
      location: input.location,
      schoolId: input.schoolId,
      ticketId: input.ticketId,
      userId: rawAssigneeIds[0] || user.id,
      assigneeIds: rawAssigneeIds,
    };
    const event = await CalendarService.createEvent(user, mapped);
    revalidatePath('/calendar');
    return { success: true, event };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create calendar event' };
  }
}

export async function updateCalendarEventAction(id: string, input: any) {
  try {
    const user = await requireAuth();
    const mapped: any = {
      title: input.title,
      description: input.description,
      type: input.type || input.eventType,
      startDate: input.startDate,
      endDate: input.endDate,
      location: input.location,
      schoolId: input.schoolId,
      ticketId: input.ticketId,
    };
    if (input.assigneeIds !== undefined) {
      mapped.assigneeIds = input.assigneeIds;
      mapped.userId = input.assigneeIds[0] || null;
    } else if (input.assignedToUserId !== undefined || input.userId !== undefined) {
      const uid = input.assignedToUserId || input.userId;
      mapped.userId = uid;
      mapped.assigneeIds = uid ? [uid] : [];
    }
    const event = await CalendarService.updateEvent(user, id, mapped);
    revalidatePath('/calendar');
    return { success: true, event };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update calendar event' };
  }
}

export async function deleteCalendarEventAction(id: string) {
  try {
    const user = await requireAuth();
    await CalendarService.deleteEvent(user, id);
    revalidatePath('/calendar');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete calendar event' };
  }
}
