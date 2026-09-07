import prisma from '@/lib/db/prisma';

export interface LogAuditParams {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface LogActivityParams {
  ticketId: string;
  actorId: string;
  type: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, any>;
}

export class AuditService {
  /**
   * Records an append-only audit log entry for system-level actions.
   */
  static async logAudit(params: LogAuditParams) {
    try {
      return await prisma.auditLog.create({
        data: {
          actorId: params.actorId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          metadata: params.metadata ? JSON.stringify(params.metadata) : null,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  }

  /**
   * Records an append-only activity event for a specific ticket timeline.
   */
  static async logActivity(params: LogActivityParams) {
    try {
      return await prisma.activityEvent.create({
        data: {
          ticketId: params.ticketId,
          actorId: params.actorId,
          type: params.type,
          title: params.title,
          description: params.description,
          metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        },
      });
    } catch (err) {
      console.error('Failed to write activity event:', err);
    }
  }
}
