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
    // Map assignedToUserId -> userId for service compatibility
    const mapped = {
      title: input.title,
      description: input.description,
      type: input.type || input.eventType || 'EVENT',
      startDate: input.startDate,
      endDate: input.endDate,
      location: input.location,
      schoolId: input.schoolId,
      ticketId: input.ticketId,
      userId: input.assignedToUserId || input.userId || user.id,
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
    const mapped = {
      title: input.title,
      description: input.description,
      type: input.type || input.eventType,
      startDate: input.startDate,
      endDate: input.endDate,
      location: input.location,
      schoolId: input.schoolId,
      ticketId: input.ticketId,
      userId: input.assignedToUserId || input.userId,
    };
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
