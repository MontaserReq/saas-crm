import prisma from '@/lib/db/prisma';
import { schoolAssignmentSchema } from '@/lib/validation';
import { AuditService } from './AuditService';
import { NotificationService } from './NotificationService';

export interface BulkAssignmentInput {
  taskTypeId: string;
  departmentId: string;
  assigneeIds: string[];
  schoolIds: string[];
  strategy?: 'EQUAL_DISTRIBUTION' | 'MANUAL';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string | null;
  notes?: string | null;
}

export class AssignmentService {
  private static async organizationForActor(actorId: string): Promise<string> {
    const membership = await prisma.organizationMember.findFirst({ where: { userId: actorId, status: 'ACTIVE', organization: { isActive: true } }, orderBy: { createdAt: 'asc' }, select: { organizationId: true } });
    return membership?.organizationId || 'org_codeline_legacy';
  }
  /**
   * Distributes an array of schools across an array of assignee IDs equally.
   */
  static distributeSchoolsEqually(schoolIds: string[], assigneeIds: string[]): Map<string, string[]> {
    const distribution = new Map<string, string[]>();
    for (const assigneeId of assigneeIds) {
      distribution.set(assigneeId, []);
    }

    schoolIds.forEach((schoolId, index) => {
      const targetAssignee = assigneeIds[index % assigneeIds.length];
      distribution.get(targetAssignee)!.push(schoolId);
    });

    return distribution;
  }

  /**
   * Generates a batch number and ticket numbers.
   */
  static async generateBatchNumber(organizationId = 'org_codeline_legacy'): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.schoolAssignment.count({ where: { organizationId } });
    return `ASN-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  /**
   * Executes atomic bulk school assignment and individual ticket generation.
   */
  static async executeBulkAssignment(input: BulkAssignmentInput, actorId: string) {
    const validated = schoolAssignmentSchema.parse(input);
    const organizationId = await this.organizationForActor(actorId);

    const schools = await prisma.school.findMany({
      // Schools with a responsible employee were already distributed (and get
      // an initial ticket on import), so reject them both in the UI and API.
      where: { id: { in: validated.schoolIds }, organizationId, isDeleted: false, status: { not: 'INACTIVE' }, responsibleEmployeeId: null },
    });

    if (schools.length === 0) {
      throw new Error('No eligible schools found for assignment');
    }
    if (schools.length !== validated.schoolIds.length) {
      throw new Error('One or more selected schools are already assigned, deleted, or inactive');
    }

    const assignees = await prisma.user.findMany({
      where: { id: { in: validated.assigneeIds }, isActive: true, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } },
      select: {
        id: true,
        name: true,
        departmentId: true,
        role: { select: { rolePermissions: { where: { permission: { code: { in: ['tickets.view_assigned', 'tickets.view_all'] } } }, select: { id: true } } } },
        userPermissions: { where: { permission: { code: { in: ['tickets.view_assigned', 'tickets.view_all'] } } }, select: { id: true } },
      },
    });

    if (assignees.length !== validated.assigneeIds.length) throw new Error('One or more selected assignees are inactive or invalid');
    if (assignees.some((assignee) => assignee.role.rolePermissions.length === 0 && assignee.userPermissions.length === 0)) throw new Error('One or more selected users are not eligible to receive tickets');

    const department = await prisma.department.findFirst({ where: { id: validated.departmentId, organizationId }, select: { id: true } });
    if (!department) throw new Error('Invalid department selected');

    const taskType = await prisma.taskType.findFirst({ where: { id: validated.taskTypeId, organizationId } });
    if (!taskType) {
      throw new Error('Invalid task type selected');
    }

    const batchNumber = `ASN-${new Date().getFullYear()}-${String(await prisma.schoolAssignment.count({ where: { organizationId } }) + 1).padStart(4, '0')}`;
    const distribution = this.distributeSchoolsEqually(
      schools.map((s) => s.id),
      assignees.map((a) => a.id)
    );

    // Get current ticket counter base
    const lastTicket = await prisma.ticket.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      select: { ticketNumber: true },
    });

    let currentTicketSeq = 1000;
    if (lastTicket && lastTicket.ticketNumber.startsWith('CL-')) {
      const parsedSeq = parseInt(lastTicket.ticketNumber.replace('CL-', ''), 10);
      if (!isNaN(parsedSeq)) {
        currentTicketSeq = parsedSeq;
      }
    }

    // Execute atomic transaction
    return await prisma.$transaction(async (tx) => {
      // 1. Create SchoolAssignment record
      const assignmentBatch = await tx.schoolAssignment.create({
        data: {
          batchNumber,
          // Kept for backward-compatible storage; the title is no longer user-entered or exposed.
          title: batchNumber,
          strategy: validated.strategy || 'EQUAL_DISTRIBUTION',
          totalSchools: schools.length,
          assignedCount: schools.length,
          notes: validated.notes || null,
          createdById: actorId,
          organizationId,
        },
      });

      const createdTickets: any[] = [];
      const schoolMap = new Map(schools.map((s) => [s.id, s]));
      const assigneeMap = new Map(assignees.map((a) => [a.id, a]));

      // 2. Loop through each assignee and their assigned schools
      for (const [assigneeId, assignedSchoolIds] of Array.from(distribution.entries())) {
        const assignee = assigneeMap.get(assigneeId)!;

        for (const schoolId of assignedSchoolIds) {
          currentTicketSeq++;
          const ticketNumber = `CL-${currentTicketSeq}`;
          const school = schoolMap.get(schoolId)!;

          // Create individual Ticket
          const ticket = await tx.ticket.create({
            data: {
              ticketNumber,
              schoolId,
              taskTypeId: validated.taskTypeId,
              departmentId: validated.departmentId || assignee.departmentId,
              assignmentId: assignmentBatch.id,
              subject: `${taskType.name}: ${school.name}`,
              priority: validated.priority || 'MEDIUM',
              status: 'PENDING',
              createdById: actorId,
              organizationId,
              dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
            },
          });

          // Create TicketAssignee
          await tx.ticketAssignee.create({
            data: {
              ticketId: ticket.id,
              userId: assigneeId,
              isCurrent: true,
              role: 'ASSIGNEE',
            },
          });

          // Create initial AssignmentHistory
          await tx.assignmentHistory.create({
            data: {
              ticketId: ticket.id,
              toUserId: assigneeId,
              performedById: actorId,
              action: 'INITIAL_ASSIGNMENT',
              reason: `Batch assignment: ${batchNumber}`,
            },
          });

          // Create initial ActivityEvent
          await tx.activityEvent.create({
            data: {
              ticketId: ticket.id,
              actorId,
              organizationId,
              type: 'CREATED',
              title: 'Ticket Created & Assigned',
              description: `Generated from assignment batch ${batchNumber} and assigned to ${assignee.name}.`,
            },
          });

          // Update School status to ASSIGNED
          await tx.school.update({
            where: { id: schoolId },
            data: { status: 'ASSIGNED' },
          });

          createdTickets.push(ticket);
        }

        // Send notification to the assignee
        await tx.notification.create({
          data: {
            userId: assigneeId,
            type: 'TICKET_ASSIGNED',
            title: 'New Schools Assigned',
            message: `You have been assigned ${assignedSchoolIds.length} new schools in assignment batch ${batchNumber}.`,
            entityType: 'assignment',
            entityId: assignmentBatch.id,
              organizationId,
          },
        });
      }

      // Record Audit Log
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'SCHOOL_ASSIGNMENT_EXECUTED',
          entityType: 'SchoolAssignment',
          entityId: assignmentBatch.id,
          metadata: JSON.stringify({
            batchNumber,
            totalSchools: schools.length,
            assigneesCount: assignees.length,
            ticketsCount: createdTickets.length,
          }),
          organizationId,
        },
      });

      return {
        batch: assignmentBatch,
        ticketsCount: createdTickets.length,
      };
    });
  }

  static async listAssignments(page = 1, pageSize = 15, organizationId = 'org_codeline_legacy') {
    const skip = (page - 1) * pageSize;
    const [total, data] = await Promise.all([
      prisma.schoolAssignment.count({ where: { organizationId } }),
      prisma.schoolAssignment.findMany({
        where: { organizationId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { tickets: true } },
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
}
