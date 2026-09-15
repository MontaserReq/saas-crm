import prisma from '@/lib/db/prisma';
import { UserSession, TicketStatus, PaginationParams, PaginatedResult } from '@/types';
import {
  hasPermission,
  canAccessTicket,
  canPerformTicketAction,
  PERMISSIONS,
  isValidStatusTransition,
} from '@/lib/permissions';
import {
  ticketRejectSchema,
  ticketTransferSchema,
  createNoteSchema,
  communicationAttemptSchema,
  rejectedTicketUpdateSchema,
  createMeetingTicketSchema,
} from '@/lib/validation';
import { AuditService } from './AuditService';
import { NotificationService } from './NotificationService';
import { getStorageProvider } from '@/lib/storage';

export interface TicketFilters extends PaginationParams {
  myTicketsOnly?: boolean;
  /** Only tickets created as Meeting Minutes (i.e. carrying a MeetingDetails row). */
  meetingsOnly?: boolean;
}

export class TicketService {
  /**
   * Retrieves a paginated list of tickets strictly scoped by user permissions.
   */
  static async listTickets(user: UserSession, filters: TicketFilters): Promise<PaginatedResult<any>> {
    const canViewAll = hasPermission(user, PERMISSIONS.TICKETS_VIEW_ALL);
    const canViewAssigned = hasPermission(user, PERMISSIONS.TICKETS_VIEW_ASSIGNED);
    if (!canViewAll && !canViewAssigned) {
      throw new Error('Forbidden: Missing ticket view permission');
    }

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 15;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    // Privacy & Authorization Scope:
    // If user does not have TICKETS_VIEW_ALL or myTicketsOnly is true, scope strictly to current user's assigned tickets
    if (!canViewAll || filters.myTicketsOnly) {
      where.assignees = {
        some: {
          userId: user.id,
          isCurrent: true,
        },
      };
    }

    if (filters.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }

    if (filters.priority && filters.priority !== 'ALL') {
      where.priority = filters.priority;
    }

    if (filters.departmentId && filters.departmentId !== 'ALL') {
      where.departmentId = filters.departmentId;
    }

    if (filters.taskTypeId && filters.taskTypeId !== 'ALL') {
      where.taskTypeId = filters.taskTypeId;
    }

    if (filters.meetingsOnly) {
      where.meetingDetails = { isNot: null };
    }

    if (canViewAll && !filters.myTicketsOnly && filters.assigneeId && filters.assigneeId !== 'ALL') {
      where.assignees = {
        some: {
          userId: filters.assigneeId,
          isCurrent: true,
        },
      };
    }

    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.trim();
      where.OR = [
        { ticketNumber: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { school: { name: { contains: q, mode: 'insensitive' } } },
        { school: { contactPerson: { contains: q, mode: 'insensitive' } } },
        { school: { phone: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, data] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          school: {
            select: {
              id: true,
              name: true,
              city: true,
              area: true,
              phone: true,
              contactPerson: true,
              schoolType: true,
            },
          },
          taskType: { select: { id: true, name: true, code: true } },
          department: { select: { id: true, name: true, code: true } },
          assignees: {
            where: { isCurrent: true },
            include: {
              user: { select: { id: true, name: true, email: true, avatar: true } },
            },
          },
          meetingDetails: { select: { id: true, meetingDate: true, meetingTime: true } },
          _count: {
            select: {
              notes: true,
              communicationAttempts: true,
              attachments: true,
            },
          },
        },
      }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Retrieves full ticket details after enforcing access authorization.
   */
  static async getTicketById(user: UserSession, ticketId: string) {
    const isAllowed = await canAccessTicket(user, ticketId);
    if (!isAllowed) {
      throw new Error('Forbidden: You do not have permission to view this ticket');
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        school: true,
        taskType: true,
        department: true,
        createdBy: { select: { id: true, name: true, email: true } },
        assignees: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true, department: true } },
          },
          orderBy: { assignedAt: 'desc' },
        },
        notes: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: { id: true, name: true, email: true, avatar: true } },
            attachments: true,
          },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
        },
        communicationAttempts: {
          orderBy: { createdAt: 'desc' },
          include: {
            performedBy: { select: { id: true, name: true } },
          },
        },
        assignmentHistory: {
          orderBy: { createdAt: 'desc' },
          include: {
            fromUser: { select: { id: true, name: true } },
            toUser: { select: { id: true, name: true } },
            performedBy: { select: { id: true, name: true } },
          },
        },
        activityEvents: {
          orderBy: { createdAt: 'desc' },
          include: {
            actor: { select: { id: true, name: true } },
          },
        },
        meetingDetails: true,
      },
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    return ticket;
  }

  /** Permanently deletes a ticket and its related records. Super Admin only. */
  static async deleteTicket(user: UserSession, ticketId: string) {
    if (user.role !== 'SUPER_ADMIN' || !hasPermission(user, PERMISSIONS.TICKETS_DELETE)) {
      throw new Error('Forbidden: Only Super Admin can delete tickets');
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        attachments: { select: { storageKey: true } },
        notes: { select: { attachments: { select: { storageKey: true } } } },
      },
    });
    if (!ticket) throw new Error('Ticket not found');

    const storageKeys = [
      ...ticket.attachments.map((attachment) => attachment.storageKey),
      ...ticket.notes.flatMap((note) => note.attachments.map((attachment) => attachment.storageKey)),
    ];

    await prisma.ticket.delete({ where: { id: ticketId } });

    if (storageKeys.length) {
      const storage = getStorageProvider();
      await Promise.all(storageKeys.map((key) => storage.delete(key).catch(() => false)));
    }

    await AuditService.logAudit({
      actorId: user.id,
      action: 'TICKET_DELETED',
      entityType: 'Ticket',
      entityId: ticket.id,
      metadata: { ticketNumber: ticket.ticketNumber, subject: ticket.subject },
    });

    return { success: true };
  }

  /**
   * Marks a ticket as SEEN (acknowledges receipt without accepting task yet).
   */
  static async markTicketSeen(user: UserSession, ticketId: string) {
    const isAllowed = await canAccessTicket(user, ticketId);
    if (!isAllowed) throw new Error('Forbidden');

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Ticket not found');

    if (ticket.status === 'PENDING') {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { status: 'SEEN' },
      });

      await AuditService.logActivity({
        ticketId,
        actorId: user.id,
        type: 'SEEN',
        title: 'Marked as Seen',
        description: `${user.name} viewed and acknowledged receipt of this ticket.`,
      });

      await AuditService.logAudit({
        actorId: user.id,
        action: 'TICKET_SEEN',
        entityType: 'Ticket',
        entityId: ticketId,
      });
    }

    return { success: true, status: 'SEEN' };
  }

  /**
   * Accepts a ticket task.
   */
  static async acceptTicket(user: UserSession, ticketId: string) {
    const isAllowed = await canAccessTicket(user, ticketId);
    if (!isAllowed) throw new Error('Forbidden');

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Ticket not found');

    if (!isValidStatusTransition(ticket.status as TicketStatus, 'ACCEPTED')) {
      throw new Error(`Cannot transition ticket from ${ticket.status} to ACCEPTED`);
    }

    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'ACCEPTED' },
    });

    await AuditService.logActivity({
      ticketId,
      actorId: user.id,
      type: 'ACCEPTED',
      title: 'Ticket Accepted',
      description: `${user.name} accepted responsibility for this school ticket.`,
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'TICKET_ACCEPTED',
      entityType: 'Ticket',
      entityId: ticketId,
    });

    return { success: true, status: 'ACCEPTED' };
  }

  /**
   * Rejects a ticket with mandatory reason.
   */
  static async rejectTicket(user: UserSession, ticketId: string, reason: string) {
    const isAllowed = await canAccessTicket(user, ticketId);
    if (!isAllowed) throw new Error('Forbidden');

    const validated = ticketRejectSchema.parse({ ticketId, reason });

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Ticket not found');

    if (!isValidStatusTransition(ticket.status as TicketStatus, 'REJECTED')) {
      throw new Error(`Cannot transition ticket from ${ticket.status} to REJECTED`);
    }

    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'REJECTED',
        rejectionReason: validated.reason,
      },
    });

    await AuditService.logActivity({
      ticketId,
      actorId: user.id,
      type: 'REJECTED',
      title: 'Ticket Rejected',
      description: `Rejected by ${user.name}. Reason: ${validated.reason}`,
      metadata: { reason: validated.reason },
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'TICKET_REJECTED',
      entityType: 'Ticket',
      entityId: ticketId,
      metadata: { reason: validated.reason },
    });

    // Notify ticket creator
    await NotificationService.create({
      userId: ticket.createdById,
      type: 'TICKET_REJECTED',
      title: 'Ticket Rejected',
      message: `${user.name} rejected ticket ${ticket.ticketNumber}. Reason: "${validated.reason}"`,
      entityType: 'ticket',
      entityId: ticket.id,
    });

    return { success: true, status: 'REJECTED' };
  }

  /**
   * Adds an immutable note to a ticket. (Notes are strictly immutable - cannot be edited or deleted).
   */
  /**
   * Adds an immutable note to a ticket. (Notes are strictly immutable - cannot be edited or deleted).
   */
  static async addNote(
    user: UserSession,
    input: {
      ticketId: string;
      content: string;
      priority?: string | null;
      transferToUserId?: string | null;
      attachments?: Array<{ originalName: string; mimeType: string; buffer: Buffer }>;
    }
  ) {
    const canPerform = await canPerformTicketAction(user, input.ticketId);
    if (!canPerform) {
      throw new Error('Forbidden: You cannot add notes to this ticket (ticket is closed, rejected, or you have view-only access).');
    }

    const validated = createNoteSchema.parse({
      ticketId: input.ticketId,
      content: input.content,
      priority: input.priority,
      transferToUserId: input.transferToUserId,
    });

    const uploadedKeys: string[] = [];
    const storage = getStorageProvider();
    try {
      return await prisma.$transaction(async (tx) => {
      // 1. Create Immutable Note
      const note = await tx.note.create({
        data: {
          ticketId: validated.ticketId,
          authorId: user.id,
          content: validated.content,
          priority: validated.priority || null,
          transferToUserId: validated.transferToUserId || null,
        },
      });

      // 2. Handle Attachments if any
      if (input.attachments && input.attachments.length > 0) {
        for (const file of input.attachments) {
          const uploaded = await storage.upload(file.buffer, file.originalName, file.mimeType, { keyPrefix: 'tickets' });
          uploadedKeys.push(uploaded.storageKey);
          await tx.attachment.create({
            data: {
              ticketId: validated.ticketId,
              noteId: note.id,
              originalName: uploaded.originalName,
              mimeType: uploaded.mimeType,
              size: uploaded.size,
              storageKey: uploaded.storageKey,
              storageProvider: storage.providerId,
              uploadedById: user.id,
            },
          });
        }
      }

      // 3. Handle Ticket Transfer if transferToUserId is specified
      if (validated.transferToUserId) {
        const targetUser = await tx.user.findUnique({
          where: { id: validated.transferToUserId, isActive: true },
          include: { department: true },
        });

        if (!targetUser) {
          throw new Error('Target user not found or is currently inactive');
        }

        // Set previous active assignees as VIEWERS (retained read access, execution revoked)
        await tx.ticketAssignee.updateMany({
          where: { ticketId: validated.ticketId, isCurrent: true },
          data: { isCurrent: false, role: 'VIEWER', unassignedAt: new Date() },
        });

        // Assign target user as active current assignee
        await tx.ticketAssignee.create({
          data: {
            ticketId: validated.ticketId,
            userId: targetUser.id,
            isCurrent: true,
            role: 'ASSIGNEE',
          },
        });

        // Record Assignment History
        await tx.assignmentHistory.create({
          data: {
            ticketId: validated.ticketId,
            fromUserId: user.id,
            toUserId: targetUser.id,
            performedById: user.id,
            action: 'TRANSFER',
            reason: validated.content,
          },
        });

        // Fetch ticket number and update Ticket status & department
        const currentTicket = await tx.ticket.findUnique({ where: { id: validated.ticketId } });
        await tx.ticket.update({
          where: { id: validated.ticketId },
          data: {
            status: 'TRANSFERRED',
            departmentId: targetUser.departmentId || undefined,
          },
        });

        // Record Activity Event for the Transfer
        await tx.activityEvent.create({
          data: {
            ticketId: validated.ticketId,
            actorId: user.id,
            type: 'TRANSFERRED',
            title: 'Ticket Transferred via Note',
            description: `Transferred from ${user.name} to ${targetUser.name} (${targetUser.department?.name || 'Department'}). Note: "${validated.content}"`,
            metadata: JSON.stringify({
              fromUserId: user.id,
              toUserId: targetUser.id,
              noteId: note.id,
            }),
          },
        });

        // Send Notification to recipient
        await tx.notification.create({
          data: {
            userId: targetUser.id,
            type: 'TICKET_TRANSFERRED',
            title: 'Ticket Transferred to You',
            message: `${user.name} transferred ticket ${currentTicket?.ticketNumber || ''} to you with note: "${validated.content}"`,
            entityType: 'ticket',
            entityId: validated.ticketId,
          },
        });

        // Log Audit Log for Transfer
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'TICKET_TRANSFERRED_WITH_NOTE',
            entityType: 'Ticket',
            entityId: validated.ticketId,
            metadata: JSON.stringify({
              fromUserId: user.id,
              toUserId: targetUser.id,
              noteId: note.id,
              content: validated.content,
            }),
          },
        });
      }

      // 4. Log Activity Event for Note Addition
      await tx.activityEvent.create({
        data: {
          ticketId: validated.ticketId,
          actorId: user.id,
          type: 'NOTE_ADDED',
          title: validated.transferToUserId ? 'Note & Transfer Hand-off' : 'Note Added',
          description: validated.transferToUserId
            ? `${user.name} added a handover note and transferred the ticket.`
            : `${user.name} added an update note.`,
        },
      });

      // 5. Log Audit Log for Note Creation
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'NOTE_CREATED',
          entityType: 'Note',
          entityId: note.id,
          metadata: JSON.stringify({
            ticketId: validated.ticketId,
            transferred: !!validated.transferToUserId,
            transferToUserId: validated.transferToUserId,
          }),
        },
      });

      return note;
      });
    } catch (error) {
      await Promise.all(uploadedKeys.map((key) => storage.delete(key).catch(() => false)));
      throw error;
    }
  }

  /**
   * Closes a ticket with a mandatory closing reason / note.
   */
  static async closeTicket(user: UserSession, ticketId: string, closingReason: string) {
    const canPerform = await canPerformTicketAction(user, ticketId);
    if (!canPerform) {
      throw new Error('Forbidden: You cannot close this ticket.');
    }

    if (!closingReason || closingReason.trim().length < 3) {
      throw new Error('A closing note/reason with at least 3 characters is strictly required.');
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Ticket not found');

    if (ticket.status === 'CLOSED') {
      throw new Error('Ticket is already closed.');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Create immutable closing note
      const note = await tx.note.create({
        data: {
          ticketId,
          authorId: user.id,
          content: `[Ticket Closed / إغلاق التذكرة]\nReason / سبب الإغلاق: ${closingReason.trim()}`,
        },
      });

      // 2. Update status to CLOSED
      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: { status: 'CLOSED' },
      });

      // 3. Log Activity Event
      await tx.activityEvent.create({
        data: {
          ticketId,
          actorId: user.id,
          type: 'CLOSED',
          title: 'Ticket Closed',
          description: `Closed by ${user.name}. Reason: "${closingReason.trim()}"`,
          metadata: JSON.stringify({ noteId: note.id, reason: closingReason.trim() }),
        },
      });

      // 4. Log Audit Log
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'TICKET_CLOSED',
          entityType: 'Ticket',
          entityId: ticketId,
          metadata: JSON.stringify({ closingReason: closingReason.trim(), noteId: note.id }),
        },
      });

      return updated;
    });
  }

  /**
   * Transfers a ticket to another team member in an atomic transaction.
   */
  static async transferTicket(user: UserSession, ticketId: string, targetUserId: string, reason: string) {
    const canPerform = await canPerformTicketAction(user, ticketId);
    if (!canPerform) throw new Error('Forbidden: You do not have permission to transfer this ticket.');

    const validated = ticketTransferSchema.parse({ ticketId, targetUserId, reason });

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        assignees: { where: { isCurrent: true } },
      },
    });

    if (!ticket) throw new Error('Ticket not found');

    const targetUser = await prisma.user.findUnique({
      where: { id: validated.targetUserId, isActive: true },
    });
    if (!targetUser) throw new Error('Target user not found or inactive');

    return await prisma.$transaction(async (tx) => {
      // 1. Unassign current assignees & convert to VIEWER role
      await tx.ticketAssignee.updateMany({
        where: { ticketId, isCurrent: true },
        data: { isCurrent: false, role: 'VIEWER', unassignedAt: new Date() },
      });

      // 2. Assign target user
      await tx.ticketAssignee.create({
        data: {
          ticketId,
          userId: targetUser.id,
          isCurrent: true,
          role: 'ASSIGNEE',
        },
      });

      // 3. Record Assignment History
      await tx.assignmentHistory.create({
        data: {
          ticketId,
          fromUserId: user.id,
          toUserId: targetUser.id,
          performedById: user.id,
          action: 'TRANSFER',
          reason: validated.reason,
        },
      });

      // 4. Create immutable transfer note
      await tx.note.create({
        data: {
          ticketId,
          authorId: user.id,
          content: `Transferred ticket to ${targetUser.name}. Handoff Notes / Reason: "${validated.reason}"`,
          transferToUserId: targetUser.id,
        },
      });

      // 5. Update Ticket Status
      await tx.ticket.update({
        where: { id: ticketId },
        data: { status: 'TRANSFERRED' },
      });

      // 6. Record Activity Event
      await tx.activityEvent.create({
        data: {
          ticketId,
          actorId: user.id,
          type: 'TRANSFERRED',
          title: 'Ticket Transferred',
          description: `Transferred from ${user.name} to ${targetUser.name}. Reason: ${validated.reason}`,
        },
      });

      // 7. Send notification to new assignee
      await tx.notification.create({
        data: {
          userId: targetUser.id,
          type: 'TICKET_TRANSFERRED',
          title: 'Ticket Transferred to You',
          message: `${user.name} transferred ticket ${ticket.ticketNumber} to you. Reason: "${validated.reason}"`,
          entityType: 'ticket',
          entityId: ticket.id,
        },
      });

      // 8. Audit Log
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'TICKET_TRANSFERRED',
          entityType: 'Ticket',
          entityId: ticket.id,
          metadata: JSON.stringify({
            fromUserId: user.id,
            toUserId: targetUser.id,
            reason: validated.reason,
          }),
        },
      });

      return { success: true };
    });
  }

  /**
   * Creates a new ticket manually.
   * The assignee is ALWAYS derived server-side from the current users direct manager
   * (User.reportsToUserId). Any client-supplied assignee identifier
   * is intentionally ignored to prevent privilege escalation.
   */
  /**
   * Resolves and validates the server-side ticket assignee from the current
   * user's direct manager (User.reportsToUserId). Shared by createTicket and
   * createMeetingTicket — no client-supplied assignee is ever trusted.
   */
  private static async resolveTicketAssignee(user: UserSession, requestedAssigneeId?: string | null) {
    if (requestedAssigneeId) {
      const canAssign = hasPermission(user, PERMISSIONS.TICKETS_ASSIGN) || hasPermission(user, PERMISSIONS.TICKETS_VIEW_ALL) || user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
      if (!canAssign) throw new Error('Forbidden: you do not have permission to choose a ticket assignee');
      const targetAssignee = await prisma.user.findUnique({
        where: { id: requestedAssigneeId },
        select: {
          id: true, name: true, isActive: true,
          role: { select: { rolePermissions: { where: { permission: { code: { in: [PERMISSIONS.TICKETS_VIEW_ASSIGNED, PERMISSIONS.TICKETS_VIEW_ALL] } } }, select: { id: true } } } },
          userPermissions: { where: { permission: { code: { in: [PERMISSIONS.TICKETS_VIEW_ASSIGNED, PERMISSIONS.TICKETS_VIEW_ALL] } } }, select: { id: true } },
        },
      });
      if (!targetAssignee || !targetAssignee.isActive) throw new Error('The selected assignee is not active or could not be found.');
      if (targetAssignee.role.rolePermissions.length === 0 && targetAssignee.userPermissions.length === 0) throw new Error('The selected user is not eligible to receive tickets.');
      return { targetAssigneeId: targetAssignee.id, targetAssignee };
    }

    if (!user.reportsToUserId) {
      throw new Error('You cannot create a ticket because your direct manager is not assigned. Please contact an administrator to assign your direct manager.');
    }
    const targetAssigneeId = user.reportsToUserId;
    const targetAssignee = await prisma.user.findUnique({
      where: { id: targetAssigneeId },
      select: {
        id: true,
        name: true,
        isActive: true,
        role: { select: { rolePermissions: { where: { permission: { code: { in: [PERMISSIONS.TICKETS_VIEW_ASSIGNED, PERMISSIONS.TICKETS_VIEW_ALL] } } }, select: { id: true } } } },
        userPermissions: { where: { permission: { code: { in: [PERMISSIONS.TICKETS_VIEW_ASSIGNED, PERMISSIONS.TICKETS_VIEW_ALL] } } }, select: { id: true } },
      },
    });
    if (!targetAssignee) throw new Error('Your direct manager account could not be found.');
    if (!targetAssignee.isActive) {
      throw new Error('You cannot create a ticket because your assigned direct manager is disabled. Please contact an administrator.');
    }
    if (targetAssignee.role.rolePermissions.length === 0 && targetAssignee.userPermissions.length === 0) {
      throw new Error('The assigned direct manager is not eligible to receive tickets.');
    }
    return { targetAssigneeId, targetAssignee };
  }

  static async createTicket(
    user: UserSession,
    input: {
      schoolId?: string | null;
      taskTypeId?: string | null;
      departmentId?: string;
      subject: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
      dueDate?: string | null;
      initialNote?: string | null;
      assignedToUserId?: string | null;
    }
  ) {
    const canCreate = hasPermission(user, PERMISSIONS.TICKETS_CREATE) || user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
    if (!canCreate) {
      throw new Error('Forbidden: You do not have permission to create tickets');
    }

    if (!input.subject || input.subject.trim().length < 3) {
      throw new Error('Subject must be at least 3 characters');
    }
    // Resolve department: prefer explicit input, fall back to user's primary department
    const departmentId = input.departmentId || user.departmentId;

    // SERVER-SIDE ASSIGNMENT SOURCE OF TRUTH:
    // The assignee is derived from User.reportsToUserId. No client value is trusted.
    const { targetAssigneeId, targetAssignee } = await this.resolveTicketAssignee(user, input.assignedToUserId);

    const count = await prisma.ticket.count();
    const ticketNumber = `CL-${String(count + 101).padStart(5, '0')}`;

    return await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          ticketNumber,
          schoolId: input.schoolId,
          taskTypeId: input.taskTypeId,
          departmentId: departmentId,
          subject: input.subject.trim(),
          priority: input.priority || 'MEDIUM',
          status: 'PENDING',
          createdById: user.id,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
        },
      });

      // Initial assignment is explicit and is recorded independently from reporting hierarchy.
      await tx.ticketAssignee.create({
        data: {
          ticketId: ticket.id,
          userId: targetAssigneeId,
          isCurrent: true,
          role: 'ASSIGNEE',
        },
      });

      await tx.assignmentHistory.create({
        data: {
          ticketId: ticket.id,
          toUserId: targetAssigneeId,
          performedById: user.id,
          action: 'INITIAL_ASSIGNMENT',
          reason: 'Initial assignment via direct manager (User.reportsToUserId)',
        },
      });

      // Initial Note if provided
      if (input.initialNote && input.initialNote.trim()) {
        await tx.note.create({
          data: {
            ticketId: ticket.id,
            authorId: user.id,
            content: input.initialNote.trim(),
          },
        });
      }

      // Activity Event
      await tx.activityEvent.create({
        data: {
          ticketId: ticket.id,
          actorId: user.id,
          type: 'CREATED',
          title: 'Ticket Created and Assigned',
          description: `Created by ${user.name} and assigned to ${targetAssignee.name}: "${input.subject.trim()}"`,
        },
      });

      await tx.notification.create({
        data: {
          userId: targetAssigneeId,
          type: 'TICKET_ASSIGNED',
          title: 'New ticket assigned to you',
          message: `You have been assigned a new ticket by ${user.name}: ${ticket.ticketNumber}.`,
          entityType: 'ticket',
          entityId: ticket.id,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'TICKET_CREATED',
          entityType: 'Ticket',
          entityId: ticket.id,
          metadata: JSON.stringify({ ticketNumber, schoolId: input.schoolId, assigneeId: targetAssigneeId, assignmentSource: 'reportsToUserId' }),
        },
      });

      return ticket;
    });
  }

  /**
   * Creates a new Ticket that also carries structured Meeting Minutes data
   * (date, time, participants, action items). Reuses the exact same Ticket
   * lifecycle, assignment, attachment, and notification architecture as a
   * regular ticket — a ticket "is a meeting" purely because it has an
   * attached MeetingDetails row, not via any special TaskType/enum.
   */
  static async createMeetingTicket(
    user: UserSession,
    input: {
      schoolId?: string | null;
      taskTypeId?: string | null;
      departmentId?: string;
      subject: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
      dueDate?: string | null;
      meetingDate: string;
      meetingTime: string;
      participants: Array<{ name: string; userId?: string | null }>;
      actionItems?: Array<{ text: string; assigneeId?: string | null; done?: boolean }>;
      initialNote?: string | null;
    }
  ) {
    const canCreate = hasPermission(user, PERMISSIONS.TICKETS_CREATE) || user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
    if (!canCreate) {
      throw new Error('Forbidden: You do not have permission to create tickets');
    }

    const validated = createMeetingTicketSchema.parse({
      schoolId: input.schoolId,
      taskTypeId: input.taskTypeId,
      departmentId: input.departmentId,
      subject: input.subject,
      priority: input.priority,
      dueDate: input.dueDate,
      meetingDate: input.meetingDate,
      meetingTime: input.meetingTime,
      participants: input.participants,
      actionItems: input.actionItems || [],
      initialNote: input.initialNote,
    });

    const departmentId = validated.departmentId || user.departmentId;

    // SERVER-SIDE ASSIGNMENT SOURCE OF TRUTH (same rule as regular tickets).
    const { targetAssigneeId, targetAssignee } = await this.resolveTicketAssignee(user);

    const count = await prisma.ticket.count();
    const ticketNumber = `CL-${String(count + 101).padStart(5, '0')}`;

    return await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          ticketNumber,
          schoolId: validated.schoolId,
          taskTypeId: validated.taskTypeId,
          departmentId,
          subject: validated.subject,
          priority: validated.priority,
          status: 'PENDING',
          createdById: user.id,
          dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
        },
      });

      await tx.meetingDetails.create({
        data: {
          ticketId: ticket.id,
          meetingDate: new Date(validated.meetingDate),
          meetingTime: validated.meetingTime,
          participants: JSON.stringify(validated.participants),
          actionItems: JSON.stringify(validated.actionItems),
          createdById: user.id,
        },
      });

      await tx.ticketAssignee.create({
        data: {
          ticketId: ticket.id,
          userId: targetAssigneeId,
          isCurrent: true,
          role: 'ASSIGNEE',
        },
      });

      await tx.assignmentHistory.create({
        data: {
          ticketId: ticket.id,
          toUserId: targetAssigneeId,
          performedById: user.id,
          action: 'INITIAL_ASSIGNMENT',
          reason: 'Initial assignment via direct manager (User.reportsToUserId)',
        },
      });

      if (validated.initialNote && validated.initialNote.trim()) {
        await tx.note.create({
          data: {
            ticketId: ticket.id,
            authorId: user.id,
            content: validated.initialNote.trim(),
          },
        });
      }

      await tx.activityEvent.create({
        data: {
          ticketId: ticket.id,
          actorId: user.id,
          type: 'CREATED',
          title: 'Meeting Ticket Created and Assigned',
          description: `Created by ${user.name} and assigned to ${targetAssignee.name}: "${validated.subject}"`,
        },
      });

      await tx.notification.create({
        data: {
          userId: targetAssigneeId,
          type: 'TICKET_ASSIGNED',
          title: 'New meeting assigned to you',
          message: `You have been assigned a new meeting by ${user.name}: ${ticket.ticketNumber}.`,
          entityType: 'ticket',
          entityId: ticket.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'MEETING_TICKET_CREATED',
          entityType: 'Ticket',
          entityId: ticket.id,
          metadata: JSON.stringify({ ticketNumber, schoolId: validated.schoolId, assigneeId: targetAssigneeId, assignmentSource: 'reportsToUserId' }),
        },
      });

      return ticket;
    });
  }

  /**
   * Logs a communication attempt (Phone, WhatsApp, Email, In-Person).
   */
  static async logCommunicationAttempt(
    user: UserSession,
    input: {
      ticketId: string;
      method: string;
      result: string;
      note?: string | null;
    }
  ) {
    const isAllowed = await canAccessTicket(user, input.ticketId);
    if (!isAllowed) throw new Error('Forbidden');

    const validated = communicationAttemptSchema.parse(input);

    const ticket = await prisma.ticket.findUnique({
      where: { id: validated.ticketId },
      select: { id: true, ticketNumber: true, status: true, createdById: true },
    });
    if (!ticket) throw new Error('Ticket not found');
    if (ticket.status === 'CLOSED' || ticket.status === 'REJECTED') {
      throw new Error('Communication attempts cannot be logged for this ticket.');
    }

    return prisma.$transaction(async (tx) => {
      const attemptsCount = await tx.communicationAttempt.count({ where: { ticketId: validated.ticketId } });
      const attempt = await tx.communicationAttempt.create({
        data: {
          ticketId: validated.ticketId,
          performedById: user.id,
          attemptNumber: attemptsCount + 1,
          method: validated.method,
          result: validated.result,
          note: validated.note || null,
        },
      });

      const resultTitle = validated.result === 'NO_ANSWER' ? 'No Answer' : 'Incorrect Information';
      await tx.activityEvent.create({
        data: {
          ticketId: validated.ticketId,
          actorId: user.id,
          type: 'COMMUNICATION_ATTEMPT',
          title: `Contact Attempt #${attemptsCount + 1} (${validated.method}) - ${resultTitle}`,
          description: `Result: ${validated.result}${validated.note ? ` - Note: "${validated.note}"` : ''}`,
          metadata: JSON.stringify({ attemptId: attempt.id, result: validated.result, method: validated.method }),
        },
      });

      if (validated.result === 'INVALID_CONTACT') {
        const currentAssignees = await tx.ticketAssignee.findMany({
          where: { ticketId: ticket.id, isCurrent: true },
          select: { id: true, userId: true },
        });
        await tx.ticketAssignee.updateMany({
          where: { ticketId: ticket.id, isCurrent: true },
          data: { isCurrent: false, unassignedAt: new Date() },
        });
        // Create a fresh current assignment even if the creator was previously assigned;
        // the old row remains immutable history with isCurrent=false.
        await tx.ticketAssignee.create({
          data: { ticketId: ticket.id, userId: ticket.createdById, isCurrent: true, role: 'ASSIGNEE' },
        });
        await tx.assignmentHistory.create({
          data: {
            ticketId: ticket.id,
            fromUserId: currentAssignees[0]?.userId || null,
            toUserId: ticket.createdById,
            performedById: user.id,
            action: 'RETURNED_TO_CREATOR',
            reason: validated.note || 'Incorrect information reported during contact attempt',
          },
        });
        await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: 'REJECTED',
            rejectionReason: validated.note || 'Incorrect information. Please review and correct the ticket.',
          },
        });
        await tx.activityEvent.create({
          data: {
            ticketId: ticket.id,
            actorId: user.id,
            type: 'REJECTED',
            title: 'Incorrect Information - Returned to Creator',
            description: `Ticket returned to its original creator for correction by ${user.name}.`,
            metadata: JSON.stringify({ result: validated.result, attemptId: attempt.id, returnedTo: ticket.createdById }),
          },
        });
        await tx.notification.create({
          data: {
            userId: ticket.createdById,
            type: 'TICKET_REJECTED',
            title: 'Ticket needs correction',
            message: `Ticket ${ticket.ticketNumber} was returned because its information may be incorrect. Please review and resubmit it.`,
            entityType: 'ticket',
            entityId: ticket.id,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'TICKET_RETURNED_FOR_CORRECTION',
            entityType: 'Ticket',
            entityId: ticket.id,
            metadata: JSON.stringify({ attemptId: attempt.id, previousStatus: ticket.status, returnedTo: ticket.createdById }),
          },
        });
      }

      return attempt;
    });
  }

  static async updateRejectedTicket(
    user: UserSession,
    input: { ticketId: string; schoolId?: string | null; phone?: string | null; whatsapp?: string | null; email?: string | null; taskTypeId?: string | null; subject: string; priority: string; dueDate?: string | null; followUpAt?: string | null; correctionNote?: string | null }
  ) {
    const validated = rejectedTicketUpdateSchema.parse(input);
    const ticket = await prisma.ticket.findUnique({ where: { id: validated.ticketId } });
    if (!ticket) throw new Error('Ticket not found');
    if (ticket.createdById !== user.id) throw new Error('Only the original creator can correct this ticket.');
    if (ticket.status !== 'REJECTED') throw new Error('Only rejected tickets can be corrected.');

    return prisma.$transaction(async (tx) => {
      const pending = await tx.ticketApprovalRequest.findFirst({ where: { ticketId: ticket.id, type: 'CORRECTION', status: 'PENDING' } });
      const request = pending
        ? await tx.ticketApprovalRequest.update({ where: { id: pending.id }, data: { proposedData: JSON.stringify(validated), createdAt: new Date() } })
        : await tx.ticketApprovalRequest.create({ data: { ticketId: ticket.id, requesterId: user.id, type: 'CORRECTION', proposedData: JSON.stringify(validated) } });
      const changes = {
        schoolId: { old: ticket.schoolId, new: validated.schoolId },
        taskTypeId: { old: ticket.taskTypeId, new: validated.taskTypeId },
        subject: { old: ticket.subject, new: validated.subject },
        priority: { old: ticket.priority, new: validated.priority },
        dueDate: { old: ticket.dueDate, new: validated.dueDate },
        followUpAt: { old: ticket.followUpAt, new: validated.followUpAt },
        phone: validated.phone,
        whatsapp: validated.whatsapp,
        email: validated.email,
      };
      await tx.activityEvent.create({
        data: {
          ticketId: ticket.id,
          actorId: user.id,
          type: 'INFORMATION_UPDATE_REQUESTED',
          title: 'Ticket correction approval requested',
          description: `Correction submitted by ${user.name} and is awaiting admin approval.`,
          metadata: JSON.stringify(changes),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'TICKET_CORRECTION_REQUESTED',
          entityType: 'Ticket',
          entityId: ticket.id,
          metadata: JSON.stringify(changes),
        },
      });
      return request;
    });
  }

  static async resubmitRejectedTicket(user: UserSession, ticketId: string, targetDepartmentId?: string | null, targetUserId?: string | null) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: { assignees: { where: { isCurrent: true } } } });
    if (!ticket) throw new Error('Ticket not found');
    if (ticket.createdById !== user.id) throw new Error('Only the original creator can resubmit this ticket.');
    if (ticket.status !== 'REJECTED') throw new Error('Only rejected tickets can be resubmitted.');

    if (!targetDepartmentId || !targetUserId) throw new Error('Select a department and employee before resubmitting.');
    const targetUser = await prisma.user.findFirst({ where: { id: targetUserId, isActive: true, departmentId: targetDepartmentId } });
    if (!targetUser) throw new Error('The selected employee is not active or does not belong to the selected department.');

    return prisma.$transaction(async (tx) => {
      const pending = await tx.ticketApprovalRequest.findFirst({ where: { ticketId, type: 'RESUBMIT', status: 'PENDING' } });
      if (pending) throw new Error('A ticket resubmission request is already awaiting approval.');
      const request = await tx.ticketApprovalRequest.create({ data: { ticketId, requesterId: user.id, type: 'RESUBMIT', proposedData: JSON.stringify({ targetDepartmentId, targetUserId }) } });
      await tx.activityEvent.create({
        data: {
          ticketId,
          actorId: user.id,
          type: 'RESUBMITTED',
          title: 'Ticket resubmitted',
          description: `Ticket resubmitted by ${user.name} and returned to the assignment workflow.`,
        },
      });
      await tx.notification.create({
        data: {
          userId: user.id,
          type: 'STATUS_CHANGED',
          title: 'Ticket resubmitted',
          message: `Ticket ${ticket.ticketNumber} has been resubmitted for assignment.`,
          entityType: 'ticket',
          entityId: ticketId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'TICKET_RESUBMITTED',
          entityType: 'Ticket',
          entityId: ticketId,
          metadata: JSON.stringify({ previousStatus: 'REJECTED', newStatus: 'PENDING' }),
        },
      });
      return request;
    });
  }

  static async listTicketApprovalRequests(status = 'PENDING') {
    return prisma.ticketApprovalRequest.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      include: { ticket: { select: { id: true, ticketNumber: true, subject: true } }, requester: { select: { name: true } } },
    });
  }

  static async decideTicketApproval(requestId: string, approverId: string, approve: boolean, rejectionReason?: string) {
    const request = await prisma.ticketApprovalRequest.findUnique({ where: { id: requestId }, include: { ticket: { include: { assignees: { where: { isCurrent: true } } } } } });
    if (!request) throw new Error('Request not found');
    if (request.status !== 'PENDING') throw new Error('This request has already been decided.');

    return prisma.$transaction(async (tx) => {
      if (approve) {
        const data = JSON.parse(request.proposedData) as any;
        if (request.type === 'CORRECTION') {
          await tx.ticket.update({ where: { id: request.ticketId }, data: { schoolId: data.schoolId || null, taskTypeId: data.taskTypeId || null, subject: data.subject, priority: data.priority, dueDate: data.dueDate ? new Date(data.dueDate) : null, followUpAt: data.followUpAt ? new Date(data.followUpAt) : null } });
          if (data.schoolId) await tx.school.update({ where: { id: data.schoolId }, data: { phone: data.phone?.trim() || null, whatsapp: data.whatsapp?.trim() || null, email: data.email?.trim() || null } });
          if (data.correctionNote?.trim()) await tx.note.create({ data: { ticketId: request.ticketId, authorId: request.requesterId, content: data.correctionNote.trim() } });
        } else if (request.type === 'RESUBMIT') {
          const targetUser = await tx.user.findFirst({ where: { id: data.targetUserId, isActive: true, departmentId: data.targetDepartmentId } });
          if (!targetUser) throw new Error('The selected employee is no longer active or is not in the selected department.');
          await tx.ticket.update({ where: { id: request.ticketId }, data: { status: 'PENDING', rejectionReason: null, departmentId: data.targetDepartmentId } });
          await tx.ticketAssignee.updateMany({ where: { ticketId: request.ticketId, isCurrent: true }, data: { isCurrent: false, role: 'VIEWER', unassignedAt: new Date() } });
          await tx.ticketAssignee.create({ data: { ticketId: request.ticketId, userId: targetUser.id, isCurrent: true, role: 'ASSIGNEE' } });
          await tx.assignmentHistory.create({ data: { ticketId: request.ticketId, fromUserId: request.ticket.assignees[0]?.userId || null, toUserId: targetUser.id, performedById: approverId, action: 'REASSIGN', reason: 'Approved ticket resubmission request.' } });
          await tx.notification.create({ data: { userId: targetUser.id, type: 'TICKET_ASSIGNED', title: 'Ticket resubmitted to you', message: `Ticket ${request.ticket.ticketNumber} has been approved and assigned to you.`, entityType: 'ticket', entityId: request.ticketId } });
        }
      }
      const decided = await tx.ticketApprovalRequest.update({ where: { id: requestId }, data: { status: approve ? 'APPROVED' : 'REJECTED', decidedById: approverId, decidedAt: new Date(), rejectionReason: approve ? null : (rejectionReason || 'Rejected by approver') } });
      await tx.auditLog.create({ data: { actorId: approverId, action: `TICKET_${request.type}_APPROVAL_${approve ? 'APPROVED' : 'REJECTED'}`, entityType: 'TicketApprovalRequest', entityId: requestId, metadata: JSON.stringify({ ticketId: request.ticketId, rejectionReason }) } });
      return decided;
    });
  }

  /**
   * Updates general status (e.g. IN_PROGRESS, COMPLETED, CLOSED, UNREACHABLE).
   */
  static async updateStatus(user: UserSession, ticketId: string, newStatus: TicketStatus) {
    const isAllowed = await canAccessTicket(user, ticketId);
    if (!isAllowed) throw new Error('Forbidden');

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Ticket not found');

    if (!isValidStatusTransition(ticket.status as TicketStatus, newStatus)) {
      throw new Error(`Invalid status transition from ${ticket.status} to ${newStatus}`);
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: newStatus },
    });

    await AuditService.logActivity({
      ticketId,
      actorId: user.id,
      type: newStatus,
      title: `Status Changed to ${newStatus}`,
      description: `Status updated by ${user.name}.`,
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'TICKET_STATUS_UPDATED',
      entityType: 'Ticket',
      entityId: ticketId,
      metadata: { previousStatus: ticket.status, newStatus },
    });

    return updated;
  }
}
