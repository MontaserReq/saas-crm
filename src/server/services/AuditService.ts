import prisma from '@/lib/db/prisma';
import { requireOrganizationIdForUserId } from '@/lib/auth/organization';

export interface LogAuditParams {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
  organizationId?: string | null;
}

export interface LogActivityParams {
  ticketId: string;
  actorId: string;
  type: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, any>;
  organizationId?: string | null;
}

export class AuditService {
  /**
   * Records an append-only audit log entry for system-level actions.
   */
  static async logAudit(params: LogAuditParams) {
    try {
      const organizationId = params.organizationId || (params.actorId ? await this.organizationForActor(params.actorId) : null);
      return await prisma.auditLog.create({
        data: {
          actorId: params.actorId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          metadata: params.metadata ? JSON.stringify(params.metadata) : null,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          organizationId,
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
      const organizationId = params.organizationId || await this.organizationForActor(params.actorId);
      return await prisma.activityEvent.create({
        data: {
          ticketId: params.ticketId,
          actorId: params.actorId,
          type: params.type,
          title: params.title,
          description: params.description,
          metadata: params.metadata ? JSON.stringify(params.metadata) : null,
          organizationId,
        },
      });
    } catch (err) {
      console.error('Failed to write activity event:', err);
    }
  }

  private static async organizationForActor(actorId: string) {
    return requireOrganizationIdForUserId(actorId);
  }
}
