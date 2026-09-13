import prisma from '@/lib/db/prisma';
import { UserSession } from '@/types';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { SchoolService } from './SchoolService';
import { TicketService } from './TicketService';
import { TodoService } from './TodoService';
import { AnalyticsService } from './AnalyticsService';
import { findHelpTopic } from '@/lib/ai-assistant/helpKnowledgeBase';

export type ToolResult = { ok: true; data: any } | { ok: false; reason: 'forbidden' | 'not_found' };

function forbidden(): ToolResult {
  return { ok: false, reason: 'forbidden' };
}

function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Every method here is a READ-ONLY tool the AI assistant can call. Each one:
 *  - re-checks permissions itself (never trusts the model/client), mirroring
 *    the same hasPermission/service-level checks used across the app,
 *  - returns a small, trimmed payload (never raw DB rows or full includes),
 *  - never throws to the caller for an expected "forbidden"/"not found" case
 *    (so the router/composer can turn it into a clean user-facing message
 *    instead of a stack trace).
 *
 * There is intentionally no createX/updateX/deleteX method in this class.
 */
export class AiAssistantToolService {
  static async searchSchools(user: UserSession, args: { query?: string; status?: string; unassignedOnly?: boolean }): Promise<ToolResult> {
    if (!hasPermission(user, PERMISSIONS.SCHOOLS_VIEW)) return forbidden();

    const result = await SchoolService.listSchools({
      search: args.query,
      status: args.status,
      unassignedOnly: args.unassignedOnly,
      page: 1,
      pageSize: 10,
    });

    return {
      ok: true,
      data: {
        totalMatching: result.total,
        schools: result.data.map((s: any) => ({
          id: s.id,
          name: s.name,
          city: s.city,
          status: s.status,
          classification: s.classification,
          responsibleEmployee: s.responsibleEmployee?.name || null,
          openTickets: s._count?.tickets ?? undefined,
        })),
      },
    };
  }

  private static async resolveSchoolId(user: UserSession, args: { schoolId?: string; name?: string }): Promise<string | null> {
    if (args.schoolId) return args.schoolId;
    if (!args.name) return null;
    const result = await SchoolService.listSchools({ search: args.name, page: 1, pageSize: 1 });
    return result.data[0]?.id || null;
  }

  static async getSchool(user: UserSession, args: { schoolId?: string; name?: string }): Promise<ToolResult> {
    if (!hasPermission(user, PERMISSIONS.SCHOOLS_VIEW)) return forbidden();

    const id = await this.resolveSchoolId(user, args);
    if (!id) return { ok: true, data: null };

    const school = await SchoolService.getSchoolById(user, id);
    if (!school) return { ok: true, data: null };

    return {
      ok: true,
      data: {
        id: school.id,
        name: school.name,
        city: school.city,
        area: school.area,
        status: school.status,
        classification: school.classification,
        contactPerson: school.contactPerson,
        phone: school.phone,
        whatsapp: school.whatsapp,
        email: school.email,
        responsibleEmployee: school.responsibleEmployee?.name || null,
        openTicketCount: school.tickets.filter((t: any) => !['CLOSED', 'REJECTED', 'COMPLETED'].includes(t.status)).length,
        totalTicketCount: school.tickets.length,
      },
    };
  }

  static async getSchoolActivity(user: UserSession, args: { schoolId?: string; name?: string }): Promise<ToolResult> {
    if (!hasPermission(user, PERMISSIONS.SCHOOLS_VIEW)) return forbidden();

    const id = await this.resolveSchoolId(user, args);
    if (!id) return { ok: true, data: null };

    const school = await SchoolService.getSchoolById(user, id);
    if (!school) return { ok: true, data: null };

    const recentTickets = [...school.tickets]
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map((t: any) => ({
        ticketNumber: t.ticketNumber,
        subject: t.subject,
        status: t.status,
        taskType: t.taskType?.name || null,
        createdAt: t.createdAt,
      }));

    return { ok: true, data: { schoolName: school.name, recentTickets } };
  }

  static async getSchoolFollowUps(user: UserSession): Promise<ToolResult> {
    if (!hasPermission(user, PERMISSIONS.SCHOOLS_VIEW)) return forbidden();
    if (!hasPermission(user, PERMISSIONS.TICKETS_VIEW_ALL) && !hasPermission(user, PERMISSIONS.TICKETS_VIEW_ASSIGNED)) return forbidden();

    const isFullView = hasPermission(user, PERMISSIONS.TICKETS_VIEW_ALL);
    const where: any = {
      followUpAt: { lte: new Date() },
      status: { notIn: ['CLOSED', 'REJECTED', 'COMPLETED'] },
      schoolId: { not: null },
    };
    if (!isFullView) where.assignees = { some: { userId: user.id, isCurrent: true } };

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { followUpAt: 'asc' },
      take: 10,
      select: {
        ticketNumber: true,
        followUpAt: true,
        school: { select: { id: true, name: true, city: true } },
      },
    });

    return {
      ok: true,
      data: {
        count: tickets.length,
        items: tickets.map((t) => ({ ticketNumber: t.ticketNumber, followUpAt: t.followUpAt, school: t.school?.name, city: t.school?.city })),
      },
    };
  }

  static async getTickets(user: UserSession, args: { status?: string; priority?: string }): Promise<ToolResult> {
    try {
      const result = await TicketService.listTickets(user, { status: args.status, priority: args.priority, page: 1, pageSize: 10 });
      return { ok: true, data: this.trimTicketList(result) };
    } catch {
      return forbidden();
    }
  }

  static async getMyTickets(user: UserSession): Promise<ToolResult> {
    try {
      const result = await TicketService.listTickets(user, { myTicketsOnly: true, page: 1, pageSize: 10 });
      return { ok: true, data: this.trimTicketList(result) };
    } catch {
      return forbidden();
    }
  }

  static async getMeetings(user: UserSession): Promise<ToolResult> {
    try {
      const result = await TicketService.listTickets(user, { meetingsOnly: true, page: 1, pageSize: 10 });
      return {
        ok: true,
        data: {
          totalMatching: result.total,
          meetings: result.data.map((t: any) => ({
            ticketNumber: t.ticketNumber,
            subject: t.subject,
            status: t.status,
            meetingDate: t.meetingDetails?.meetingDate,
            meetingTime: t.meetingDetails?.meetingTime,
          })),
        },
      };
    } catch {
      return forbidden();
    }
  }

  static async getMeetingMinutes(user: UserSession, args: { ticketId?: string; ticketNumber?: string }): Promise<ToolResult> {
    let ticketId = args.ticketId || null;
    if (!ticketId && args.ticketNumber) {
      const ticket = await prisma.ticket.findUnique({ where: { ticketNumber: args.ticketNumber }, select: { id: true } });
      ticketId = ticket?.id || null;
    }
    if (!ticketId) return { ok: true, data: null };

    try {
      const ticket: any = await TicketService.getTicketById(user, ticketId);
      if (!ticket.meetingDetails) return { ok: true, data: null };
      return {
        ok: true,
        data: {
          subject: ticket.subject,
          meetingDate: ticket.meetingDetails.meetingDate,
          meetingTime: ticket.meetingDetails.meetingTime,
          participants: parseJsonArray<{ name: string }>(ticket.meetingDetails.participants).map((p) => p.name),
          actionItems: parseJsonArray<{ text: string }>(ticket.meetingDetails.actionItems).map((a) => a.text),
        },
      };
    } catch {
      return forbidden();
    }
  }

  static async getMyTasks(user: UserSession): Promise<ToolResult> {
    if (!hasPermission(user, PERMISSIONS.TODO_VIEW) && !hasPermission(user, PERMISSIONS.TODO_MANAGE_OWN)) return forbidden();
    // Always the caller's own id — a Todo has no cross-user visibility concept,
    // and the model/client can never supply a different user id here.
    const todos = await TodoService.listTodos(user.id);
    return {
      ok: true,
      data: {
        count: todos.length,
        items: todos.slice(0, 10).map((t) => ({ title: t.title, priority: t.priority, dueDate: t.dueDate, isCompleted: t.isCompleted })),
      },
    };
  }

  static async getDashboardStats(user: UserSession): Promise<ToolResult> {
    const result = await AnalyticsService.getDashboardMetrics(user);
    return { ok: true, data: { metrics: result.metrics } };
  }

  static async getMostOpenAssignees(user: UserSession): Promise<ToolResult> {
    if (!hasPermission(user, PERMISSIONS.TICKETS_VIEW_ALL)) return forbidden();

    const rows = await prisma.ticketAssignee.groupBy({
      by: ['userId'],
      where: { isCurrent: true, ticket: { status: { notIn: ['CLOSED', 'REJECTED', 'COMPLETED'] } } },
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 5,
    });
    if (rows.length === 0) return { ok: true, data: { items: [] } };

    const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true } });
    const nameById = new Map(users.map((u) => [u.id, u.name]));

    return {
      ok: true,
      data: { items: rows.map((r) => ({ name: nameById.get(r.userId) || 'Unknown', openCount: r._count.userId })) },
    };
  }

  static async getCurrentUserPermissions(user: UserSession): Promise<ToolResult> {
    return { ok: true, data: { role: user.roleDisplayName, department: user.departmentName, permissions: user.permissions } };
  }

  static help(user: UserSession, args: { topic?: string }): ToolResult {
    const topic = args.topic ? findHelpTopic(args.topic) : null;
    if (!topic) return { ok: true, data: null };
    if (topic.permission && !hasPermission(user, topic.permission)) return forbidden();
    return { ok: true, data: topic };
  }

  private static trimTicketList(result: { total: number; data: any[] }) {
    return {
      totalMatching: result.total,
      tickets: result.data.map((t: any) => ({
        ticketNumber: t.ticketNumber,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        createdAt: t.createdAt,
        assignee: t.assignees?.[0]?.user?.name || null,
        isMeeting: !!t.meetingDetails,
      })),
    };
  }
}
