'use server';

import prisma from '@/lib/db/prisma';
import { requireAuth, hashPassword, verifyPassword, createSession } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { userCreateSchema, userUpdateSchema } from '@/lib/validation';
import { AuditService } from '@/server/services/AuditService';
import { revalidatePath } from 'next/cache';
import { requireOrganizationId } from '@/lib/auth/organization';

async function validateReportingManager(userId: string | null | undefined, managerId: string | null | undefined, organizationId: string) {
  if (!managerId) return;
  if (userId && userId === managerId) throw new Error('A user cannot report to themselves');
  const manager = await prisma.user.findFirst({ where: { id: managerId, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } }, select: { id: true, isActive: true } });
  if (!manager || !manager.isActive) throw new Error('The selected reporting manager is not active');

  // Walk upward so a user can never become their own ancestor.
  const visited = new Set<string>();
  let cursor: string | null = managerId;
  while (cursor) {
    if (userId && cursor === userId) throw new Error('Circular reporting hierarchy is not allowed');
    if (visited.has(cursor)) throw new Error('Circular reporting hierarchy is not allowed');
    visited.add(cursor);
    const parent: { reportsToUserId: string | null } | null = await prisma.user.findFirst({ where: { id: cursor, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } }, select: { reportsToUserId: true } });
    cursor = parent?.reportsToUserId || null;
  }
}

export async function createUserAction(data: any) {
  try {
    const user = await requireAuth();
    const organizationId = requireOrganizationId(user);
    if (!hasPermission(user, PERMISSIONS.USERS_CREATE)) {
      return { success: false, error: 'Forbidden' };
    }
    if (data.reportsToUserId && !hasPermission(user, PERMISSIONS.USERS_MANAGE_REPORTING)) return { success: false, error: 'Forbidden: reporting hierarchy permission required' };

    const validated = userCreateSchema.parse(data);
    const department = await prisma.department.findFirst({ where: { id: validated.departmentId, organizationId }, select: { id: true } });
    if (!department) return { success: false, error: 'Selected department does not belong to the active organization' };
    await validateReportingManager(null, validated.reportsToUserId, organizationId);
    const existing = await prisma.user.findUnique({ where: { email: validated.email.toLowerCase() } });
    if (existing) {
      return { success: false, error: 'A user with this email already exists' };
    }

    const passwordHash = await hashPassword(validated.password);

    const newUser = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: {
        name: validated.name,
        email: validated.email.toLowerCase(),
        phone: validated.phone || null,
        passwordHash,
        roleId: validated.roleId,
        departmentId: validated.departmentId,
        reportsToUserId: validated.reportsToUserId || null,
      } });
      await tx.organizationMember.create({ data: { organizationId, userId: created.id, roleId: created.roleId, status: 'ACTIVE' } });
      return created;
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: newUser.id,
      metadata: { email: newUser.email, name: newUser.name },
    });

    revalidatePath('/admin/users');
    return { success: true, user: newUser };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create user' };
  }
}

export async function getUserForEditAction(id: string) {
  try {
    const actor = await requireAuth();
    const organizationId = requireOrganizationId(actor);
    if (!hasPermission(actor, PERMISSIONS.USERS_UPDATE)) return { success: false, error: 'Forbidden' };

    const target = await prisma.user.findUnique({
      where: { id, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        roleId: true,
        departmentId: true,
        isActive: true,
        accessMode: true,
        allowedIps: true,
        reportsToUserId: true,
        userPermissions: { select: { permissionId: true } },
      },
    });
    if (!target) return { success: false, error: 'User not found' };

    return { success: true, user: target };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to load user details' };
  }
}

export async function getLoginSessionsAction(targetUserId: string) {
  const user = await requireAuth();
  const organizationId = requireOrganizationId(user);
  if (!hasPermission(user, PERMISSIONS.USERS_VIEW_SESSIONS)) return { success: false, error: 'Forbidden' };
  const target = await prisma.user.findFirst({ where: { id: targetUserId, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } }, select: { id: true } });
  if (!target) return { success: false, error: 'User not found' };
  const sessions = await prisma.loginSession.findMany({ where: { userId: target.id }, orderBy: { loginAt: 'desc' }, take: 100 });
  return { success: true, sessions };
}

export async function updateUserAction(id: string, data: any) {
  try {
    const user = await requireAuth();
    const organizationId = requireOrganizationId(user);
    if (!hasPermission(user, PERMISSIONS.USERS_UPDATE)) {
      return { success: false, error: 'Forbidden' };
    }

    const validated = userUpdateSchema.parse(data);
    const existingUser = await prisma.user.findFirst({ where: { id, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } }, select: { name: true, email: true, phone: true, roleId: true, departmentId: true, isActive: true, accessMode: true, allowedIps: true, reportsToUserId: true, userPermissions: { select: { permissionId: true } } } });
    if (!existingUser) return { success: false, error: 'User not found' };
    if (validated.isActive !== existingUser.isActive && !hasPermission(user, validated.isActive ? PERMISSIONS.USERS_ENABLE : PERMISSIONS.USERS_DISABLE)) return { success: false, error: 'Forbidden: account status permission required' };
    const canManageAccess = hasPermission(user, PERMISSIONS.USERS_MANAGE_ACCESS_RESTRICTIONS);
    let currentAllowedIps: string[] = [];
    try { currentAllowedIps = existingUser.allowedIps ? JSON.parse(existingUser.allowedIps) : []; } catch { currentAllowedIps = []; }
    if ((validated.accessMode !== existingUser.accessMode || JSON.stringify(validated.allowedIps) !== JSON.stringify(currentAllowedIps)) && !canManageAccess) return { success: false, error: 'Forbidden: access restriction permission required' };
    const canManageRoles = hasPermission(user, PERMISSIONS.USERS_MANAGE_ROLES);
    if (validated.roleId !== existingUser.roleId && !canManageRoles) return { success: false, error: 'Forbidden: role assignment permission required' };
    const canManageReporting = hasPermission(user, PERMISSIONS.USERS_MANAGE_REPORTING);
    if (validated.reportsToUserId !== existingUser.reportsToUserId && !canManageReporting) return { success: false, error: 'Forbidden: reporting hierarchy permission required' };
    const department = await prisma.department.findFirst({ where: { id: validated.departmentId, organizationId }, select: { id: true } });
    if (!department) return { success: false, error: 'Selected department does not belong to the active organization' };
    await validateReportingManager(id, canManageReporting ? validated.reportsToUserId : existingUser.reportsToUserId, organizationId);

    const updateData: any = {
      name: validated.name,
      email: validated.email.toLowerCase(),
      phone: validated.phone || null,
      roleId: canManageRoles ? validated.roleId : existingUser.roleId,
      departmentId: validated.departmentId,
      isActive: validated.isActive,
      accessMode: canManageAccess ? validated.accessMode : existingUser.accessMode,
      allowedIps: canManageAccess ? JSON.stringify(validated.allowedIps) : existingUser.allowedIps,
      reportsToUserId: canManageReporting ? validated.reportsToUserId || null : existingUser.reportsToUserId,
    };

    const currentPermissionIds = existingUser.userPermissions.map((permission) => permission.permissionId).sort();
    const requestedPermissionIds = validated.directPermissionIds === undefined
      ? currentPermissionIds
      : Array.from(new Set(validated.directPermissionIds)).sort();
    const permissionsChanged = JSON.stringify(currentPermissionIds) !== JSON.stringify(requestedPermissionIds);
    if (permissionsChanged) {
      if (!hasPermission(user, PERMISSIONS.USERS_MANAGE_PERMISSIONS)) return { success: false, error: 'Forbidden: direct permissions management required' };
      const validPermissionCount = await prisma.permission.count({ where: { id: { in: requestedPermissionIds } } });
      if (validPermissionCount !== requestedPermissionIds.length) return { success: false, error: 'One or more permissions are invalid' };
    }

    if (validated.password && validated.password.trim() !== '') {
      updateData.passwordHash = await hashPassword(validated.password);
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id }, data: updateData });
      if (permissionsChanged) {
        await tx.userPermission.deleteMany({ where: { userId: id } });
        if (requestedPermissionIds.length) await tx.userPermission.createMany({ data: requestedPermissionIds.map((permissionId) => ({ userId: id, permissionId })) });
      }
      return updated;
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: updatedUser.id,
      metadata: {
        changes: {
          ...(existingUser.name !== updatedUser.name ? { name: { old: existingUser.name, new: updatedUser.name } } : {}),
          ...(validated.email.toLowerCase() !== existingUser.email ? { email: { old: existingUser.email, new: updatedUser.email } } : {}),
          ...(validated.phone !== undefined && (validated.phone || null) !== existingUser.phone ? { phone: { old: existingUser.phone, new: validated.phone || null } } : {}),
          ...(validated.roleId !== existingUser.roleId ? { roleId: { old: existingUser.roleId, new: validated.roleId } } : {}),
          ...(validated.departmentId !== existingUser.departmentId ? { departmentId: { old: existingUser.departmentId, new: validated.departmentId } } : {}),
          ...(validated.isActive !== existingUser.isActive ? { isActive: { old: existingUser.isActive, new: validated.isActive } } : {}),
          ...(validated.reportsToUserId !== existingUser.reportsToUserId ? { reportsToUserId: { old: existingUser.reportsToUserId, new: validated.reportsToUserId || null } } : {}),
          ...(validated.password && validated.password.trim() !== '' ? { password: { changed: true } } : {}),
          ...(permissionsChanged ? { directPermissionIds: { old: currentPermissionIds, new: requestedPermissionIds } } : {}),
        },
        email: updatedUser.email,
        name: updatedUser.name,
      },
    });

    revalidatePath('/admin/users');
    return { success: true, user: updatedUser };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update user' };
  }
}

export async function disableUserAction(id: string) {
  try {
    const user = await requireAuth();
    const organizationId = requireOrganizationId(user);
    if (!hasPermission(user, PERMISSIONS.USERS_DISABLE)) {
      return { success: false, error: 'Forbidden: Insufficient permissions to disable user' };
    }

    if (id === user.id) {
      return { success: false, error: 'Cannot disable your own account' };
    }

    const target = await prisma.user.findFirst({ where: { id, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } }, select: { id: true } });
    if (!target) return { success: false, error: 'User not found' };

    const [targetUser] = await prisma.$transaction([
      prisma.user.update({ where: { id: target.id }, data: { isActive: false } }),
      prisma.loginSession.updateMany({ where: { userId: target.id, logoutAt: null }, data: { logoutAt: new Date() } }),
    ]);

    await AuditService.logAudit({ actorId: user.id, action: 'USER_DISABLED', entityType: 'User', entityId: id, metadata: { name: targetUser.name, email: targetUser.email, activeSessionsRevoked: true } });

    revalidatePath('/admin/users');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to disable user' };
  }
}

export async function enableUserAction(id: string) {
  try {
    const user = await requireAuth();
    const organizationId = requireOrganizationId(user);
    if (!hasPermission(user, PERMISSIONS.USERS_ENABLE)) return { success: false, error: 'Forbidden: Insufficient permissions to enable user' };
    const target = await prisma.user.findFirst({ where: { id, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } }, select: { id: true } });
    if (!target) return { success: false, error: 'User not found' };
    const targetUser = await prisma.user.update({ where: { id: target.id }, data: { isActive: true } });
    await AuditService.logAudit({ actorId: user.id, action: 'USER_ENABLED', entityType: 'User', entityId: id, metadata: { name: targetUser.name, email: targetUser.email } });
    revalidatePath('/admin/users');
    return { success: true };
  } catch (err: any) { return { success: false, error: err.message || 'Failed to enable user' }; }
}

export async function deleteUserAction(id: string) {
  try {
    const user = await requireAuth();
    const organizationId = requireOrganizationId(user);
    if (user.role !== 'SUPER_ADMIN') {
      return { success: false, error: 'Forbidden: Super Admin access required' };
    }
    if (id === user.id) {
      return { success: false, error: 'Cannot delete your own account' };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } },
      include: {
        _count: {
          select: {
            ticketAssignees: true,
            notes: true,
            createdTickets: true,
            sentMessages: true,
          },
        },
      },
    });

    if (!targetUser) return { success: false, error: 'User not found' };

    const count = (targetUser as any)._count;
    const hasRelations =
      (count?.ticketAssignees || 0) > 0 ||
      (count?.notes || 0) > 0 ||
      (count?.createdTickets || 0) > 0 ||
      (count?.sentMessages || 0) > 0;

    if (hasRelations) {
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
      await AuditService.logAudit({
        actorId: user.id,
        action: 'USER_DISABLED',
        entityType: 'User',
        entityId: id,
        metadata: { reason: 'Deactivated due to historical audit relations', name: targetUser.name },
      });
      revalidatePath('/admin/users');
      return { success: true, deactivated: true, message: 'User deactivated to preserve historical audit data' };
    }

    await prisma.user.delete({ where: { id } });
    await AuditService.logAudit({
      actorId: user.id,
      action: 'USER_DELETED',
      entityType: 'User',
      entityId: id,
      metadata: { name: targetUser.name, email: targetUser.email },
    });
    revalidatePath('/admin/users');
    return { success: true, deactivated: false, message: 'User deleted successfully' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete user' };
  }
}

export async function transferUserWorkAction(data: {
  fromUserId: string;
  toUserId: string;
  transferOpenTickets?: boolean;
  transferResponsibleSchools?: boolean;
}) {
  try {
    const user = await requireAuth();
    const organizationId = requireOrganizationId(user);
    if (!hasPermission(user, PERMISSIONS.USERS_TRANSFER_WORK)) {
      return { success: false, error: 'Forbidden: Admin access required for work transfer' };
    }

    const { fromUserId, toUserId, transferOpenTickets = true, transferResponsibleSchools = true } = data;

    if (fromUserId === toUserId) {
      return { success: false, error: 'Source and destination users must be different' };
    }

    const [fromUser, toUser] = await Promise.all([
      prisma.user.findFirst({ where: { id: fromUserId, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } } }),
      prisma.user.findFirst({ where: { id: toUserId, isActive: true, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } }, include: { department: true } }),
    ]);

    if (!fromUser || !toUser) {
      return { success: false, error: 'User not found or target user is inactive' };
    }

    let transferredTicketsCount = 0;
    let transferredSchoolsCount = 0;

    await prisma.$transaction(async (tx) => {
      // 1. Transfer Open Active Tickets
      if (transferOpenTickets) {
        const activeTickets = await tx.ticket.findMany({
          where: {
            status: { notIn: ['CLOSED', 'REJECTED'] },
            assignees: {
              some: {
                userId: fromUserId,
                isCurrent: true,
              },
            },
          },
        });

        for (const ticket of activeTickets) {
          // Unassign previous user and retain as viewer
          await tx.ticketAssignee.updateMany({
            where: { ticketId: ticket.id, isCurrent: true },
            data: { isCurrent: false, role: 'VIEWER', unassignedAt: new Date() },
          });

          // Assign new user
          await tx.ticketAssignee.create({
            data: {
              ticketId: ticket.id,
              userId: toUserId,
              isCurrent: true,
              role: 'ASSIGNEE',
            },
          });

          // Record assignment history
          await tx.assignmentHistory.create({
            data: {
              ticketId: ticket.id,
              fromUserId: fromUserId,
              toUserId: toUserId,
              performedById: user.id,
              action: 'TRANSFER',
              reason: `Administrative offboarding / work transfer from ${fromUser.name} to ${toUser.name}`,
            },
          });

          // Update status to TRANSFERRED and update department
          await tx.ticket.update({
            where: { id: ticket.id },
            data: {
              status: 'TRANSFERRED',
              departmentId: toUser.departmentId || undefined,
            },
          });

          // Record Activity Event
          await tx.activityEvent.create({
            data: {
              ticketId: ticket.id,
              actorId: user.id,
              type: 'TRANSFERRED',
              title: 'Work Transferred by Admin',
              description: `Admin ${user.name} transferred ticket responsibility from ${fromUser.name} to ${toUser.name}.`,
            },
          });
        }

        transferredTicketsCount = activeTickets.length;
      }

      // 2. Transfer Responsible Schools
      if (transferResponsibleSchools) {
        const updatedSchools = await tx.school.updateMany({
          where: { responsibleEmployeeId: fromUserId },
          data: { responsibleEmployeeId: toUserId },
        });
        transferredSchoolsCount = updatedSchools.count;
      }
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'USER_WORK_TRANSFERRED',
      entityType: 'User',
      entityId: fromUserId,
      metadata: {
        fromUser: fromUser.name,
        toUser: toUser.name,
        transferredTicketsCount,
        transferredSchoolsCount,
      },
    });

    revalidatePath('/admin/users');
    revalidatePath('/tickets');
    revalidatePath('/schools');
    return {
      success: true,
      transferredTicketsCount,
      transferredSchoolsCount,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Work transfer failed' };
  }
}

export async function updateUserProfileAction(data: { name?: string; phone?: string; avatar?: string }) {
  try {
    const user = await requireAuth();

    const updateData: any = {};
    if (data.name && data.name.trim().length >= 2) updateData.name = data.name.trim();
    if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'PROFILE_UPDATED',
      entityType: 'User',
      entityId: user.id,
      metadata: updateData,
    });

    revalidatePath('/profile');
    revalidatePath('/settings');
    return { success: true, user: updated };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update profile' };
  }
}

export async function updateUserCredentialsAction(data: {
  currentPassword: string;
  newEmail?: string;
  newPassword?: string;
}) {
  try {
    const user = await requireAuth();

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
        department: true,
      },
    });

    if (!dbUser) throw new Error('User not found');

    const isValid = await verifyPassword(data.currentPassword, dbUser.passwordHash);
    if (!isValid) {
      return { success: false, error: 'Current password is incorrect' };
    }

    const updateData: any = {};

    if (data.newEmail && data.newEmail.trim().toLowerCase() !== dbUser.email) {
      const email = data.newEmail.trim().toLowerCase();
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return { success: false, error: 'Email is already taken by another account' };
      }
      updateData.email = email;
    }

    if (data.newPassword && data.newPassword.length >= 6) {
      updateData.passwordHash = await hashPassword(data.newPassword);
    }

    if (Object.keys(updateData).length === 0) {
      return { success: true, message: 'No changes provided' };
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    if (updateData.passwordHash) {
      await prisma.loginSession.updateMany({
        where: { userId: user.id, logoutAt: null, ...(user.sessionId ? { id: { not: user.sessionId } } : {}) },
        data: { logoutAt: new Date() },
      });
    }

    await AuditService.logAudit({
      actorId: user.id,
      action: 'CREDENTIALS_UPDATED',
      entityType: 'User',
      entityId: user.id,
      metadata: { emailUpdated: !!updateData.email, passwordUpdated: !!updateData.passwordHash },
    });

    // Re-issue updated session cookie
    await createSession({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      avatar: updated.avatar,
      role: user.role,
      roleDisplayName: user.roleDisplayName,
      departmentId: dbUser.department.id,
      departmentName: dbUser.department.name,
      permissions: user.permissions,
      sessionId: user.sessionId,
    });

    revalidatePath('/profile');
    revalidatePath('/settings');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update credentials' };
  }
}
