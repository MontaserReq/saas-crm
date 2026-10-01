'use server';

import prisma from '@/lib/db/prisma';
import { requireAuth, verifyPassword } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { departmentSchema, taskTypeSchema } from '@/lib/validation';
import { AuditService } from '@/server/services/AuditService';
import { revalidatePath } from 'next/cache';

// ==========================================
// ADMIN PASSWORD CONFIRMATION (Server-Side)
// ==========================================

export async function verifyAdminPasswordAction(password: string) {
  try {
    const user = await requireAuth();
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      return { success: false, error: 'Forbidden: Admin access required' };
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    if (!dbUser) {
      return { success: false, error: 'User record not found' };
    }

    const isValid = await verifyPassword(password, dbUser.passwordHash);
    if (!isValid) {
      return { success: false, error: 'Incorrect password' };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Password verification failed' };
  }
}

// ==========================================
// DEPARTMENTS CRUD (Super Admin Controlled)
// ==========================================

export async function createDepartmentAction(data: any, managerUserIds: string[] = []) {
  try {
    const user = await requireAuth();
    if (user.role !== 'SUPER_ADMIN' && !hasPermission(user, PERMISSIONS.DEPARTMENTS_MANAGE)) {
      return { success: false, error: 'Forbidden: Super Admin access required' };
    }

    const validated = departmentSchema.parse(data);
    const organizationId = user.organizationId || 'org_codeline_legacy';

    // Check duplicate code
    const existing = await prisma.department.findFirst({
      where: { code: validated.code, organizationId },
    });
    if (existing) {
      return { success: false, error: `Department code "${validated.code}" is already in use` };
    }

    const department = await prisma.$transaction(async (tx) => {
      const dept = await tx.department.create({
        data: {
          name: validated.name,
          code: validated.code,
          description: validated.description || null,
          isActive: validated.isActive !== undefined ? validated.isActive : true,
          organizationId,
        },
      });

      if (managerUserIds && managerUserIds.length > 0) {
        const managers = await tx.user.count({ where: { id: { in: managerUserIds }, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } } });
        if (managers !== managerUserIds.length) throw new Error('Every department manager must belong to the active organization');
        await tx.departmentManager.createMany({
          data: managerUserIds.map((uId) => ({
            departmentId: dept.id,
            userId: uId,
          })),
        });
      }

      return dept;
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'DEPARTMENT_CREATED',
      entityType: 'Department',
      entityId: department.id,
      metadata: { name: department.name, code: department.code, managersCount: managerUserIds.length },
    });

    revalidatePath('/admin/departments');
    return { success: true, department };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create department' };
  }
}

export async function updateDepartmentAction(id: string, data: any, managerUserIds: string[] = []) {
  try {
    const user = await requireAuth();
    if (user.role !== 'SUPER_ADMIN' && !hasPermission(user, PERMISSIONS.DEPARTMENTS_MANAGE)) {
      return { success: false, error: 'Forbidden: Super Admin access required' };
    }

    const validated = departmentSchema.parse(data);
    const organizationId = user.organizationId || 'org_codeline_legacy';

    // Check if code taken by another department
    const existing = await prisma.department.findFirst({
      where: {
        code: validated.code,
        id: { not: id },
        organizationId,
      },
    });
    if (existing) {
      return { success: false, error: `Department code "${validated.code}" is already in use by another department` };
    }

    const department = await prisma.$transaction(async (tx) => {
      const dept = await tx.department.update({
        where: { id, organizationId },
        data: {
          name: validated.name,
          code: validated.code,
          description: validated.description || null,
          isActive: validated.isActive !== undefined ? validated.isActive : true,
        },
      });

      // Update managers
      await tx.departmentManager.deleteMany({ where: { departmentId: id } });
      if (managerUserIds && managerUserIds.length > 0) {
        const managers = await tx.user.count({ where: { id: { in: managerUserIds }, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } } });
        if (managers !== managerUserIds.length) throw new Error('Every department manager must belong to the active organization');
        await tx.departmentManager.createMany({
          data: managerUserIds.map((uId) => ({
            departmentId: id,
            userId: uId,
          })),
        });
      }

      return dept;
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'DEPARTMENT_UPDATED',
      entityType: 'Department',
      entityId: department.id,
      metadata: { name: department.name, code: department.code, isActive: department.isActive },
    });

    revalidatePath('/admin/departments');
    return { success: true, department };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update department' };
  }
}

export async function deleteDepartmentAction(id: string) {
  try {
    const user = await requireAuth();
    if (user.role !== 'SUPER_ADMIN') {
      return { success: false, error: 'Forbidden: Only Super Admin can delete or archive departments' };
    }

    const organizationId = user.organizationId || 'org_codeline_legacy';
    const department = await prisma.department.findFirst({
      where: { id, organizationId },
      include: {
        _count: {
          select: {
            users: true,
            tickets: true,
          },
        },
      },
    });

    if (!department) {
      return { success: false, error: 'Department not found' };
    }

    // Safety check: If department is referenced in users or tickets, deactivate/archive instead of hard deletion
    if (department._count.users > 0 || department._count.tickets > 0) {
      await prisma.department.update({
        where: { id },
        data: { isActive: false },
      });

      await AuditService.logAudit({
        actorId: user.id,
        action: 'DEPARTMENT_DEACTIVATED',
        entityType: 'Department',
        entityId: id,
        metadata: {
          reason: 'Safe archive due to existing relations',
          usersCount: department._count.users,
          ticketsCount: department._count.tickets,
        },
      });

      revalidatePath('/admin/departments');
      return {
        success: true,
        deactivated: true,
        message: `Department "${department.name}" has active members (${department._count.users}) or tickets (${department._count.tickets}) and has been safely deactivated/archived to preserve operational integrity.`,
      };
    }

    // No linked records -> safe hard delete
    await prisma.department.delete({ where: { id } });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'DEPARTMENT_DELETED',
      entityType: 'Department',
      entityId: id,
      metadata: { name: department.name, code: department.code },
    });

    revalidatePath('/admin/departments');
    return { success: true, deactivated: false, message: `Department "${department.name}" deleted successfully.` };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete department' };
  }
}

export async function toggleDepartmentStatusAction(id: string) {
  try {
    const user = await requireAuth();
    if (user.role !== 'SUPER_ADMIN') {
      return { success: false, error: 'Forbidden: Only Super Admin can modify department status' };
    }

    const organizationId = user.organizationId || 'org_codeline_legacy';
    const department = await prisma.department.findFirst({ where: { id, organizationId } });
    if (!department) return { success: false, error: 'Department not found' };

    const updated = await prisma.department.update({
      where: { id },
      data: { isActive: !department.isActive },
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'DEPARTMENT_STATUS_TOGGLED',
      entityType: 'Department',
      entityId: id,
      metadata: { newStatus: updated.isActive },
    });

    revalidatePath('/admin/departments');
    return { success: true, isActive: updated.isActive };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to toggle department status' };
  }
}

// ==========================================
// TASK TYPES CRUD (Super Admin Controlled)
// ==========================================

export async function createTaskTypeAction(data: any) {
  try {
    const user = await requireAuth();
    if (user.role !== 'SUPER_ADMIN' && !hasPermission(user, PERMISSIONS.TASK_TYPES_MANAGE)) {
      return { success: false, error: 'Forbidden: Super Admin access required' };
    }

    const validated = taskTypeSchema.parse(data);
    const organizationId = user.organizationId || 'org_codeline_legacy';

    const memberIds = validated.members.map((member) => member.userId);
    if (new Set(memberIds).size !== memberIds.length) return { success: false, error: 'Duplicate team members are not allowed' };

    const taskType = await prisma.$transaction(async (tx) => {
      const department = await tx.department.findFirst({ where: { id: validated.departmentId, organizationId }, select: { id: true } });
      if (!department) throw new Error('Department not found');
      const users = await tx.user.findMany({ where: { id: { in: memberIds }, departmentId: department.id, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } }, select: { id: true } });
      if (users.length !== memberIds.length) throw new Error('Every team member must belong to the selected department');

      const generatedCode = `TASK_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const created = await tx.taskType.create({
        data: {
          name: validated.name,
          code: generatedCode,
          departmentId: validated.departmentId,
          description: validated.description || null,
          isActive: validated.isActive !== undefined ? validated.isActive : true,
          createdById: user.id,
          organizationId,
          members: { create: validated.members.map((member) => ({ userId: member.userId, responsibility: member.responsibility })) },
        },
        include: { department: true, members: { include: { user: { select: { id: true, name: true, email: true } } } } },
      });
      return created;
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'TASK_TYPE_CREATED',
      entityType: 'TaskType',
      entityId: taskType.id,
      metadata: { name: taskType.name, departmentId: taskType.departmentId, membersCount: taskType.members.length },
    });

    revalidatePath('/admin/task-types');
    return { success: true, taskType };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create task type' };
  }
}

export async function updateTaskTypeAction(id: string, data: any) {
  try {
    const user = await requireAuth();
    if (user.role !== 'SUPER_ADMIN' && !hasPermission(user, PERMISSIONS.TASK_TYPES_MANAGE)) {
      return { success: false, error: 'Forbidden: Super Admin access required' };
    }

    const validated = taskTypeSchema.parse(data);
    const organizationId = user.organizationId || 'org_codeline_legacy';

    const memberIds = validated.members.map((member) => member.userId);
    if (new Set(memberIds).size !== memberIds.length) return { success: false, error: 'Duplicate team members are not allowed' };

    const taskType = await prisma.$transaction(async (tx) => {
      const department = await tx.department.findFirst({ where: { id: validated.departmentId, organizationId }, select: { id: true } });
      if (!department) throw new Error('Department not found');
      const users = await tx.user.findMany({ where: { id: { in: memberIds }, departmentId: department.id, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } }, select: { id: true } });
      if (users.length !== memberIds.length) throw new Error('Every team member must belong to the selected department');
      const existing = await tx.taskType.findFirst({ where: { id, organizationId }, select: { id: true } });
      if (!existing) throw new Error('Task type not found');
      return tx.taskType.update({
        where: { id: existing.id },
        data: {
          name: validated.name,
          departmentId: validated.departmentId,
          description: validated.description || null,
          isActive: validated.isActive !== undefined ? validated.isActive : true,
          members: {
            deleteMany: {},
            create: validated.members.map((member) => ({ userId: member.userId, responsibility: member.responsibility })),
          },
        },
        include: { department: true, members: { include: { user: { select: { id: true, name: true, email: true } } } } },
      });
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'TASK_TYPE_UPDATED',
      entityType: 'TaskType',
      entityId: taskType.id,
      metadata: { name: taskType.name, departmentId: taskType.departmentId, membersCount: taskType.members.length, isActive: taskType.isActive },
    });

    revalidatePath('/admin/task-types');
    return { success: true, taskType };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update task type' };
  }
}

export async function deleteTaskTypeAction(id: string) {
  try {
    const user = await requireAuth();
    if (user.role !== 'SUPER_ADMIN') {
      return { success: false, error: 'Forbidden: Only Super Admin can delete or archive task types' };
    }

    const organizationId = user.organizationId || 'org_codeline_legacy';
    const taskType = await prisma.taskType.findFirst({
      where: { id, organizationId },
      include: {
        _count: {
          select: { tickets: true },
        },
      },
    });

    if (!taskType) {
      return { success: false, error: 'Task type not found' };
    }

    // Safety check: If task type has existing tickets, deactivate/archive instead of hard deleting to preserve legacy references
    if (taskType._count.tickets > 0) {
      await prisma.taskType.update({
        where: { id },
        data: { isActive: false },
      });

      await AuditService.logAudit({
        actorId: user.id,
        action: 'TASK_TYPE_DEACTIVATED',
        entityType: 'TaskType',
        entityId: id,
        metadata: {
          reason: 'Safe archive due to existing tickets',
          ticketsCount: taskType._count.tickets,
        },
      });

      revalidatePath('/admin/task-types');
      return {
        success: true,
        deactivated: true,
        message: `Task type "${taskType.name}" is referenced in ${taskType._count.tickets} existing tickets and has been safely deactivated/archived to preserve historical data.`,
      };
    }

    // No tickets -> safe hard delete
    await prisma.taskType.delete({ where: { id } });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'TASK_TYPE_DELETED',
      entityType: 'TaskType',
      entityId: id,
      metadata: { name: taskType.name, departmentId: taskType.departmentId },
    });

    revalidatePath('/admin/task-types');
    return { success: true, deactivated: false, message: `Task type "${taskType.name}" deleted successfully.` };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete task type' };
  }
}

export async function toggleTaskTypeStatusAction(id: string) {
  try {
    const user = await requireAuth();
    if (user.role !== 'SUPER_ADMIN') {
      return { success: false, error: 'Forbidden: Only Super Admin can modify task type status' };
    }

    const organizationId = user.organizationId || 'org_codeline_legacy';
    const taskType = await prisma.taskType.findFirst({ where: { id, organizationId } });
    if (!taskType) return { success: false, error: 'Task type not found' };

    const updated = await prisma.taskType.update({
      where: { id },
      data: { isActive: !taskType.isActive },
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'TASK_TYPE_STATUS_TOGGLED',
      entityType: 'TaskType',
      entityId: id,
      metadata: { newStatus: updated.isActive },
    });

    revalidatePath('/admin/task-types');
    return { success: true, isActive: updated.isActive };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to toggle task type status' };
  }
}

// ==========================================
// ROLES & PERMISSIONS MANAGEMENT
// ==========================================

export async function updateRolePermissionsAction(roleId: string, permissionIds: string[]) {
  try {
    const user = await requireAuth();
    if (user.role !== 'SUPER_ADMIN') {
      return { success: false, error: 'Only Super Admin can update role permissions' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.rolePermission.createMany({
        data: permissionIds.map((pId) => ({ roleId, permissionId: pId })),
      });
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: 'ROLE_PERMISSIONS_UPDATED',
      entityType: 'Role',
      entityId: roleId,
      metadata: { permissionCount: permissionIds.length },
    });

    revalidatePath('/admin/roles');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function listUserPermissionsAction(userId: string) {
  try {
    const actor = await requireAuth();
    const organizationId = actor.organizationId || 'org_codeline_legacy';
    if (!hasPermission(actor, PERMISSIONS.USERS_MANAGE_PERMISSIONS)) return { success: false, error: 'Forbidden' };
    const target = await prisma.user.findFirst({ where: { id: userId, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } }, select: { id: true } });
    if (!target) return { success: false, error: 'User not found' };
    const permissions = await prisma.userPermission.findMany({ where: { userId }, include: { permission: true }, orderBy: { permission: { module: 'asc' } } });
    return { success: true, permissions };
  } catch (err: any) { return { success: false, error: err.message || 'Failed to load user permissions' }; }
}

export async function updateUserPermissionsAction(userId: string, permissionIds: string[]) {
  try {
    const actor = await requireAuth();
    const organizationId = actor.organizationId || 'org_codeline_legacy';
    if (!hasPermission(actor, PERMISSIONS.USERS_MANAGE_PERMISSIONS)) return { success: false, error: 'Forbidden' };
    if (userId === actor.id) return { success: false, error: 'You cannot change your own permissions' };
    const target = await prisma.user.findFirst({ where: { id: userId, organizationMemberships: { some: { organizationId, status: 'ACTIVE' } } }, select: { id: true } });
    if (!target) return { success: false, error: 'User not found' };
    const ids = Array.from(new Set(permissionIds.filter((id) => typeof id === 'string' && id.length > 0)));
    const valid = await prisma.permission.count({ where: { id: { in: ids } } });
    if (valid !== ids.length) return { success: false, error: 'One or more permissions are invalid' };
    await prisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({ where: { userId } });
      if (ids.length) await tx.userPermission.createMany({ data: ids.map((permissionId) => ({ userId, permissionId })) });
    });
    await AuditService.logAudit({ actorId: actor.id, action: 'USER_PERMISSIONS_UPDATED', entityType: 'User', entityId: userId, metadata: { permissionIds: ids, permissionCount: ids.length } });
    revalidatePath('/admin/users');
    return { success: true };
  } catch (err: any) { return { success: false, error: err.message || 'Failed to update user permissions' }; }
}
