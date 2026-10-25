"use server";

import { requireAuth } from "@/lib/auth/session";
import { CalendarService } from "@/server/services/CalendarService";
import { revalidatePath } from "next/cache";
import { OperationApprovalService } from "@/server/services/OperationApprovalService";
import prisma from "@/lib/db/prisma";

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
    return {
      success: false,
      error: err.message || "Failed to fetch calendar events",
    };
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
    const ticket = input.ticketNumber
      ? await prisma.ticket.findFirst({ where: { organizationId: user.organizationId, ticketNumber: { equals: String(input.ticketNumber).trim(), mode: "insensitive" } }, select: { id: true } })
      : null;
    if (input.ticketNumber && !ticket) throw new Error("Ticket number was not found in this company");

    const mapped = {
      title: input.title,
      description: input.description,
      type: input.type || input.eventType || "MEETING",
      startDate: input.startDate,
      endDate: input.endDate,
      location: input.location,
      schoolId: input.schoolId,
      clientId: input.clientId,
      ticketId: ticket?.id || input.ticketId,
      userId: rawAssigneeIds[0] || user.id,
      assigneeIds: rawAssigneeIds,
      departmentId: input.departmentId || user.departmentId,
    };
    const approval = await OperationApprovalService.submitIfRequired(user, "CALENDAR_EVENT", "CREATE", { input: mapped }, { entityLabel: mapped.title });
    if (approval) return { success: true, pendingApproval: true, requestId: approval.id };
    const event = await CalendarService.createEvent(user, mapped);
    revalidatePath("/calendar");
    return { success: true, event };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to create calendar event",
    };
  }
}

export async function updateCalendarEventAction(id: string, input: any) {
  try {
    const user = await requireAuth();
    const ticket = input.ticketNumber
      ? await prisma.ticket.findFirst({ where: { organizationId: user.organizationId, ticketNumber: { equals: String(input.ticketNumber).trim(), mode: "insensitive" } }, select: { id: true } })
      : null;
    if (input.ticketNumber && !ticket) throw new Error("Ticket number was not found in this company");
    const mapped: any = {
      title: input.title,
      description: input.description,
      type: input.type || input.eventType,
      startDate: input.startDate,
      endDate: input.endDate,
      location: input.location,
      schoolId: input.schoolId,
      clientId: input.clientId,
      ticketId: ticket?.id || input.ticketId,
    };
    if (input.assigneeIds !== undefined) {
      mapped.assigneeIds = input.assigneeIds;
      mapped.userId = input.assigneeIds[0] || null;
    } else if (
      input.assignedToUserId !== undefined ||
      input.userId !== undefined
    ) {
      const uid = input.assignedToUserId || input.userId;
      mapped.userId = uid;
      mapped.assigneeIds = uid ? [uid] : [];
    }
    const approval = await OperationApprovalService.submitIfRequired(user, "CALENDAR_EVENT", "UPDATE", { id, input: mapped }, { entityId: id, entityLabel: mapped.title });
    if (approval) return { success: true, pendingApproval: true, requestId: approval.id };
    const event = await CalendarService.updateEvent(user, id, mapped);
    revalidatePath("/calendar");
    return { success: true, event };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to update calendar event",
    };
  }
}

export async function deleteCalendarEventAction(id: string) {
  try {
    const user = await requireAuth();
    const approval = await OperationApprovalService.submitIfRequired(user, "CALENDAR_EVENT", "DELETE", { id }, { entityId: id });
    if (approval) return { success: true, pendingApproval: true, requestId: approval.id };
    await CalendarService.deleteEvent(user, id);
    revalidatePath("/calendar");
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to delete calendar event",
    };
  }
}
