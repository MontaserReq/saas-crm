import prisma from '@/lib/db/prisma';
import { requireOrganizationContext } from '@/lib/auth/organization';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import type { UserSession, RoleName } from '@/types';
import {
  APPROVAL_OPERATIONS,
  APPROVAL_RESOURCES,
  DEFAULT_APPROVAL_RULES,
  type ApprovalRules,
} from './OrganizationConfigService';
import { AuditService } from './AuditService';

export type ApprovalResource = (typeof APPROVAL_RESOURCES)[number];
export type ApprovalOperation = (typeof APPROVAL_OPERATIONS)[number];

export function parseApprovalRules(value?: string | null): ApprovalRules {
  try {
    const parsed = value ? JSON.parse(value) : {};
    return Object.fromEntries(
      APPROVAL_RESOURCES.map((resource) => [resource, { ...DEFAULT_APPROVAL_RULES[resource], ...(parsed[resource] || {}) }]),
    ) as ApprovalRules;
  } catch {
    return DEFAULT_APPROVAL_RULES;
  }
}

export class OperationApprovalService {
  static canBypass(user: UserSession) {
    return user.role === 'SUPER_ADMIN' || user.role === 'PLATFORM_ADMIN' || hasPermission(user, PERMISSIONS.APPROVAL_REQUESTS_DECIDE);
  }

  static async submitIfRequired(
    user: UserSession,
    resourceType: ApprovalResource,
    operation: ApprovalOperation,
    payload: unknown,
    options: { entityId?: string | null; entityLabel?: string | null } = {},
  ) {
    if (this.canBypass(user)) return null;
    const organizationId = (await requireOrganizationContext(user)).id;
    const settings = await prisma.organizationSettings.findUnique({ where: { organizationId }, select: { approvalRules: true } });
    if (!parseApprovalRules(settings?.approvalRules)[resourceType][operation]) return null;

    if (options.entityId) {
      const existing = await prisma.operationApprovalRequest.findFirst({
        where: { organizationId, resourceType, operation, entityId: options.entityId, status: 'PENDING' },
        select: { id: true },
      });
      if (existing) {
        return prisma.operationApprovalRequest.update({
          where: { id: existing.id },
          data: { payload: JSON.stringify(payload), entityLabel: options.entityLabel?.trim() || null },
        });
      }
    }

    const request = await prisma.operationApprovalRequest.create({
      data: {
        organizationId,
        resourceType,
        operation,
        entityId: options.entityId || null,
        entityLabel: options.entityLabel?.trim() || null,
        payload: JSON.stringify(payload),
        requesterId: user.id,
      },
    });
    await AuditService.logAudit({
      actorId: user.id,
      organizationId,
      action: 'OPERATION_APPROVAL_REQUESTED',
      entityType: resourceType,
      entityId: options.entityId || request.id,
      metadata: { requestId: request.id, operation },
    });
    return request;
  }

  static async list(user: UserSession, status = 'PENDING') {
    if (!hasPermission(user, PERMISSIONS.APPROVAL_REQUESTS_VIEW) && !hasPermission(user, PERMISSIONS.APPROVAL_REQUESTS_DECIDE)) {
      throw new Error('Forbidden');
    }
    const organizationId = (await requireOrganizationContext(user)).id;
    return prisma.operationApprovalRequest.findMany({
      where: { organizationId, ...(status === 'ALL' ? {} : { status }) },
      include: {
        requester: { select: { id: true, name: true, email: true, department: { select: { name: true } } } },
        decidedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
    });
  }

  static async claim(user: UserSession, id: string) {
    if (!hasPermission(user, PERMISSIONS.APPROVAL_REQUESTS_DECIDE) && user.role !== 'SUPER_ADMIN' && user.role !== 'PLATFORM_ADMIN') {
      throw new Error('Forbidden');
    }
    const organizationId = (await requireOrganizationContext(user)).id;
    const request = await prisma.operationApprovalRequest.findFirst({ where: { id, organizationId, status: 'PENDING' } });
    if (!request) throw new Error('Approval request not found or already decided');
    const claimed = await prisma.operationApprovalRequest.updateMany({
      where: { id, organizationId, status: 'PENDING' },
      data: { status: 'PROCESSING', decidedById: user.id },
    });
    if (claimed.count !== 1) throw new Error('Approval request is already being processed');
    return request;
  }

  static async finish(user: UserSession, id: string, approved: boolean, rejectionReason?: string) {
    const organizationId = (await requireOrganizationContext(user)).id;
    const request = await prisma.operationApprovalRequest.update({
      where: { id },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        decidedById: user.id,
        decidedAt: new Date(),
        rejectionReason: approved ? null : rejectionReason?.trim() || null,
      },
    });
    await AuditService.logAudit({
      actorId: user.id,
      organizationId,
      action: approved ? 'OPERATION_APPROVAL_APPROVED' : 'OPERATION_APPROVAL_REJECTED',
      entityType: request.resourceType,
      entityId: request.entityId || request.id,
      metadata: { requestId: request.id, operation: request.operation, rejectionReason: request.rejectionReason },
    });
    return request;
  }

  static async release(id: string) {
    await prisma.operationApprovalRequest.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: 'PENDING', decidedById: null } });
  }

  static async requesterSession(requesterId: string, organizationId: string): Promise<UserSession> {
    const requester = await prisma.user.findFirstOrThrow({
      where: { id: requesterId, isActive: true, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } },
      select: {
        id: true, name: true, email: true, phone: true, avatar: true, isPlatformAdmin: true, reportsToUserId: true,
        department: { select: { id: true, name: true } },
        role: { select: { name: true, displayName: true, rolePermissions: { select: { permission: { select: { code: true } } } } } },
        organizationMemberships: {
          where: { organizationId, status: 'ACTIVE' }, take: 1,
          select: { role: { select: { name: true, displayName: true, rolePermissions: { select: { permission: { select: { code: true } } } } } } },
        },
        userPermissions: { select: { permission: { select: { code: true } } } },
      },
    });
    const membershipRole = requester.organizationMemberships[0]?.role || requester.role;
    const permissions = [...new Set([
      ...(membershipRole.rolePermissions || []).map((item) => item.permission.code),
      ...requester.userPermissions.map((item) => item.permission.code),
    ])];
    return {
      id: requester.id,
      name: requester.name,
      email: requester.email,
      phone: requester.phone,
      avatar: requester.avatar,
      role: membershipRole.name as RoleName,
      isPlatformAdmin: requester.isPlatformAdmin,
      roleDisplayName: membershipRole.displayName,
      departmentId: requester.department.id,
      departmentName: requester.department.name,
      reportsToUserId: requester.reportsToUserId,
      permissions,
      organizationId,
    };
  }
}
