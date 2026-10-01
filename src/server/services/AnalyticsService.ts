import prisma from '@/lib/db/prisma';
import { UserSession } from '@/types';
import { requireOrganizationId } from '@/lib/auth/organization';

export class AnalyticsService {
  static async getDashboardMetrics(user?: UserSession | null) {
    if (!user) {
      return {
        metrics: {
          pending: 0,
          seen: 0,
          accepted: 0,
          transferred: 0,
          inProgress: 0,
          rejected: 0,
          unreachable: 0,
          completed: 0,
          closed: 0,
          total: 0,
          totalSchools: 0,
          totalAssignedSchools: 0,
        },
        needsAttention: [],
        recentActivity: [],
      };
    }

    // Admins get a global operational overview; other accounts see only their
    // currently assigned tickets.
    const organizationId = requireOrganizationId(user);
    const isGlobalOverview = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
    const ticketFilter: any = isGlobalOverview
      ? { organizationId }
      : {
          organizationId,
          assignees: {
            some: {
              userId: user.id,
              isCurrent: true,
            },
          },
        };

    const [
      pendingCount,
      seenCount,
      acceptedCount,
      transferredCount,
      inProgressCount,
      rejectedCount,
      unreachableCount,
      completedCount,
      closedCount,
      totalTickets,
      totalSchools,
      totalAssignedSchools,
      needsAttentionTickets,
      recentActivity,
    ] = await Promise.all([
      prisma.ticket.count({ where: { ...ticketFilter, status: 'PENDING' } }),
      prisma.ticket.count({ where: { ...ticketFilter, status: 'SEEN' } }),
      prisma.ticket.count({ where: { ...ticketFilter, status: 'ACCEPTED' } }),
      prisma.ticket.count({ where: { ...ticketFilter, status: 'TRANSFERRED' } }),
      prisma.ticket.count({ where: { ...ticketFilter, status: 'IN_PROGRESS' } }),
      prisma.ticket.count({ where: { ...ticketFilter, status: 'REJECTED' } }),
      prisma.ticket.count({ where: { ...ticketFilter, status: 'UNREACHABLE' } }),
      prisma.ticket.count({ where: { ...ticketFilter, status: 'COMPLETED' } }),
      prisma.ticket.count({ where: { ...ticketFilter, status: 'CLOSED' } }),
      prisma.ticket.count({ where: ticketFilter }),
      prisma.school.count({ where: { organizationId, isDeleted: false } }),
      prisma.school.count({ where: { organizationId, status: 'ASSIGNED', isDeleted: false } }),
      // Needs Attention: pending or seen tickets with high/urgent priority
      prisma.ticket.findMany({
        where: {
          ...ticketFilter,
          status: { in: ['PENDING', 'SEEN'] },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: 5,
        include: {
          school: { select: { name: true, city: true } },
          taskType: { select: { name: true } },
        },
      }),
      // Recent Activity
      prisma.activityEvent.findMany({
        where: isGlobalOverview
          ? { organizationId }
          : {
              organizationId,
              ticket: {
                assignees: {
                  some: { userId: user.id, isCurrent: true },
                },
              },
            },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          actor: { select: { name: true } },
          ticket: { select: { ticketNumber: true, subject: true } },
        },
      }),
    ]);

    return {
      metrics: {
        pending: pendingCount,
        seen: seenCount,
        accepted: acceptedCount,
        transferred: transferredCount,
        inProgress: inProgressCount,
        rejected: rejectedCount,
        unreachable: unreachableCount,
        completed: completedCount,
        closed: closedCount,
        total: totalTickets,
        totalSchools,
        totalAssignedSchools,
      },
      needsAttention: needsAttentionTickets,
      recentActivity,
    };
  }

  static async getAdminAnalytics(user?: UserSession | null) {
    if (!user) throw new Error('Unauthorized: active organization context required');
    const organizationId = requireOrganizationId(user);
    const [
      ticketsByDepartment,
      ticketsByTaskType,
      ticketsByMember,
      communicationByResult,
      usersWithLogs,
    ] = await Promise.all([
      prisma.department.findMany({
        where: { organizationId },
        select: {
          name: true,
          _count: { select: { tickets: true } },
        },
      }),
      prisma.taskType.findMany({
        where: { organizationId },
        select: {
          name: true,
          _count: { select: { tickets: true } },
        },
      }),
      prisma.user.findMany({
        where: { isActive: true, role: { name: 'MEMBER' }, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } },
        select: {
          name: true,
          _count: {
            select: {
              ticketAssignees: { where: { isCurrent: true } },
            },
          },
        },
      }),
      prisma.communicationAttempt.groupBy({
        by: ['result'],
        where: { ticket: { organizationId } },
        _count: { result: true },
      }),
      prisma.user.findMany({
        where: { isActive: true, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } },
        select: {
          id: true,
          name: true,
          email: true,
          lastLoginAt: true,
          department: { select: { name: true } },
          auditLogs: {
            where: {
              action: { in: ['AUTH_LOGIN', 'AUTH_LOGOUT', 'TICKET_CREATED', 'NOTE_CREATED', 'COMMUNICATION_ATTEMPT'] },
              organizationId,
            },
            orderBy: { createdAt: 'asc' },
            select: { action: true, createdAt: true },
          },
        },
      }),
    ]);

    // Calculate real Time Spent and Session statistics per user
    const userTimeStats = usersWithLogs.map((u) => {
      const logs = u.auditLogs;
      let totalMinutes = 0;
      let sessionsCount = 0;
      let lastLogout: Date | null = null;

      let currentLoginTime: Date | null = null;
      let lastActivityTime: Date | null = null;

      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        const logTime = new Date(log.createdAt);

        if (log.action === 'AUTH_LOGIN') {
          sessionsCount++;
          currentLoginTime = logTime;
          lastActivityTime = logTime;
        } else if (log.action === 'AUTH_LOGOUT') {
          lastLogout = logTime;
          if (currentLoginTime) {
            const diffMin = Math.max(1, Math.round((logTime.getTime() - currentLoginTime.getTime()) / (1000 * 60)));
            totalMinutes += Math.min(diffMin, 480); // Cap session at 8 hours max if no logout
            currentLoginTime = null;
            lastActivityTime = null;
          }
        } else {
          // General activity within session
          if (currentLoginTime) {
            const idleGap = lastActivityTime ? (logTime.getTime() - lastActivityTime.getTime()) / (1000 * 60) : 0;
            if (idleGap < 60) {
              lastActivityTime = logTime;
            } else {
              // Idle session expired
              if (lastActivityTime) {
                totalMinutes += Math.max(1, Math.round((lastActivityTime.getTime() - currentLoginTime.getTime()) / (1000 * 60)));
              }
              currentLoginTime = logTime;
              lastActivityTime = logTime;
              sessionsCount++;
            }
          } else {
            currentLoginTime = logTime;
            lastActivityTime = logTime;
            sessionsCount++;
          }
        }
      }

      // If session currently open
      if (currentLoginTime && lastActivityTime) {
        const diffMin = Math.max(1, Math.round((lastActivityTime.getTime() - currentLoginTime.getTime()) / (1000 * 60)));
        totalMinutes += Math.min(diffMin, 120);
      }

      // Default reasonable minimum if sessions exist
      if (sessionsCount > 0 && totalMinutes === 0) {
        totalMinutes = sessionsCount * 15;
      }

      const avgSessionMinutes = sessionsCount > 0 ? Math.round(totalMinutes / sessionsCount) : 0;

      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        department: u.department.name,
        totalMinutes,
        sessionsCount,
        lastLogin: u.lastLoginAt,
        lastLogout,
        avgSessionMinutes,
      };
    });

    return {
      ticketsByDepartment: ticketsByDepartment.map((d) => ({ name: d.name, count: d._count.tickets })),
      ticketsByTaskType: ticketsByTaskType.map((t) => ({ name: t.name, count: t._count.tickets })),
      ticketsByMember: ticketsByMember.map((u) => ({ name: u.name, count: u._count.ticketAssignees })),
      communicationByResult: communicationByResult.map((c) => ({ result: c.result, count: c._count.result })),
      userTimeStats,
    };
  }
}
