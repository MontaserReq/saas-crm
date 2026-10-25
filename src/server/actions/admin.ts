"use server";

import prisma from "@/lib/db/prisma";
import {
  canManageProtectedAccount,
  isPlatformSuperAdmin,
} from "@/lib/security/platform";
import { requireAuth, verifyPassword } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { departmentSchema, taskTypeSchema } from "@/lib/validation";
import { AuditService } from "@/server/services/AuditService";
import { requireOrganizationId } from "@/lib/auth/organization";
import { revalidatePath } from "next/cache";
import { OperationApprovalService } from "@/server/services/OperationApprovalService";
import { filterPermissionsForPlan } from "@/lib/platform/entitlements";

// ==========================================
// ADMIN PASSWORD CONFIRMATION (Server-Side)
// ==========================================

export async function verifyAdminPasswordAction(password: string) {
  try {
    const user = await requireAuth();
    if (
      !isPlatformSuperAdmin(user) &&
      !["SUPER_ADMIN", "ADMIN"].includes(user.role)
    ) {
      return { success: false, error: "Forbidden: Admin access required" };
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    if (!dbUser) {
      return { success: false, error: "User record not found" };
    }

    const isValid = await verifyPassword(password, dbUser.passwordHash);
    if (!isValid) {
      return { success: false, error: "Incorrect password" };
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Password verification failed",
    };
  }
}

// ==========================================
// DEPARTMENTS CRUD (Super Admin Controlled)
// ==========================================

export async function createDepartmentAction(
  data: any,
  managerUserIds: string[] = [],
) {
  try {
    const user = await requireAuth();
    if (
      !isPlatformSuperAdmin(user) &&
      !hasPermission(user, PERMISSIONS.DEPARTMENTS_MANAGE)
    ) {
      return {
        success: false,
        error: "Forbidden: Super Admin access required",
      };
    }

    const validated = departmentSchema.parse(data);
    const organizationId = requireOrganizationId(user);

    // Check duplicate code
    const existing = await prisma.department.findFirst({
      where: { code: validated.code, organizationId },
    });
    if (existing) {
      return {
        success: false,
        error: `Department code "${validated.code}" is already in use`,
      };
    }
    const approval = await OperationApprovalService.submitIfRequired(
      user,
      "DEPARTMENT",
      "CREATE",
      { data: validated, managerUserIds },
      { entityLabel: validated.name },
    );
    if (approval) return { success: true, pendingApproval: true, requestId: approval.id };

    const department = await prisma.$transaction(async (tx) => {
      const dept = await tx.department.create({
        data: {
          name: validated.name,
          code: validated.code,
          description: validated.description || null,
          isActive:
            validated.isActive !== undefined ? validated.isActive : true,
          organizationId,
        },
      });

      if (managerUserIds && managerUserIds.length > 0) {
        const managers = await tx.user.count({
          where: {
            id: { in: managerUserIds },
            organizationMemberships: {
              some: { organizationId, status: "ACTIVE" },
            },
          },
        });
        if (managers !== managerUserIds.length)
          throw new Error(
            "Every department manager must belong to the active organization",
          );
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
      action: "DEPARTMENT_CREATED",
      entityType: "Department",
      entityId: department.id,
      metadata: {
        name: department.name,
        code: department.code,
        managersCount: managerUserIds.length,
      },
    });

    revalidatePath("/admin/departments");
    return { success: true, department };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to create department",
    };
  }
}

export async function updateDepartmentAction(
  id: string,
  data: any,
  managerUserIds: string[] = [],
) {
  try {
    const user = await requireAuth();
    if (
      !isPlatformSuperAdmin(user) &&
      !hasPermission(user, PERMISSIONS.DEPARTMENTS_MANAGE)
    ) {
      return {
        success: false,
        error: "Forbidden: Super Admin access required",
      };
    }

    const validated = departmentSchema.parse(data);
    const organizationId = requireOrganizationId(user);

    // Check if code taken by another department
    const existing = await prisma.department.findFirst({
      where: {
        code: validated.code,
        id: { not: id },
        organizationId,
      },
    });
    if (existing) {
      return {
        success: false,
        error: `Department code "${validated.code}" is already in use by another department`,
      };
    }
    const approval = await OperationApprovalService.submitIfRequired(
      user,
      "DEPARTMENT",
      "UPDATE",
      { id, data: validated, managerUserIds },
      { entityId: id, entityLabel: validated.name },
    );
    if (approval) return { success: true, pendingApproval: true, requestId: approval.id };

    const department = await prisma.$transaction(async (tx) => {
      const dept = await tx.department.update({
        where: { id, organizationId },
        data: {
          name: validated.name,
          code: validated.code,
          description: validated.description || null,
          isActive:
            validated.isActive !== undefined ? validated.isActive : true,
        },
      });

      // Update managers
      await tx.departmentManager.deleteMany({ where: { departmentId: id } });
      if (managerUserIds && managerUserIds.length > 0) {
        const managers = await tx.user.count({
          where: {
            id: { in: managerUserIds },
            organizationMemberships: {
              some: { organizationId, status: "ACTIVE" },
            },
          },
        });
        if (managers !== managerUserIds.length)
          throw new Error(
            "Every department manager must belong to the active organization",
          );
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
      action: "DEPARTMENT_UPDATED",
      entityType: "Department",
      entityId: department.id,
      metadata: {
        name: department.name,
        code: department.code,
        isActive: department.isActive,
      },
    });

    revalidatePath("/admin/departments");
    return { success: true, department };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to update department",
    };
  }
}

export async function deleteDepartmentAction(id: string) {
  try {
    const user = await requireAuth();
    if (
      !isPlatformSuperAdmin(user) &&
      !hasPermission(user, PERMISSIONS.DEPARTMENTS_MANAGE)
    ) {
      return {
        success: false,
        error: "Forbidden: Department management permission required",
      };
    }

    const organizationId = requireOrganizationId(user);
    const department = await prisma.department.findFirst({
      where: { id, organizationId },
      include: {
        _count: {
          select: {
            users: true,
            tickets: true,
            crmTasks: true,
            calendarEvents: true,
          },
        },
      },
    });

    if (!department) {
      return { success: false, error: "Department not found" };
    }
    const approval = await OperationApprovalService.submitIfRequired(
      user,
      "DEPARTMENT",
      "DELETE",
      { id },
      { entityId: id, entityLabel: department.name },
    );
    if (approval) return { success: true, pendingApproval: true, requestId: approval.id };

    // Safety check: If department is referenced in users or tickets, deactivate/archive instead of hard deletion
    if (
      department._count.users > 0 ||
      department._count.tickets > 0 ||
      department._count.crmTasks > 0 ||
      department._count.calendarEvents > 0
    ) {
      await prisma.department.update({
        where: { id },
        data: { isActive: false },
      });

      await AuditService.logAudit({
        actorId: user.id,
        action: "DEPARTMENT_DEACTIVATED",
        entityType: "Department",
        entityId: id,
        metadata: {
          reason: "Safe archive due to existing relations",
          usersCount: department._count.users,
          ticketsCount: department._count.tickets,
          tasksCount: department._count.crmTasks,
          calendarEventsCount: department._count.calendarEvents,
        },
      });

      revalidatePath("/admin/departments");
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
      action: "DEPARTMENT_DELETED",
      entityType: "Department",
      entityId: id,
      metadata: { name: department.name, code: department.code },
    });

    revalidatePath("/admin/departments");
    return {
      success: true,
      deactivated: false,
      message: `Department "${department.name}" deleted successfully.`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to delete department",
    };
  }
}

export async function toggleDepartmentStatusAction(id: string) {
  try {
    const user = await requireAuth();
    if (
      !isPlatformSuperAdmin(user) &&
      !hasPermission(user, PERMISSIONS.DEPARTMENTS_MANAGE)
    ) {
      return {
        success: false,
        error: "Forbidden: Department management permission required",
      };
    }

    const organizationId = requireOrganizationId(user);
    const department = await prisma.department.findFirst({
      where: { id, organizationId },
    });
    if (!department) return { success: false, error: "Department not found" };

    const approval = await OperationApprovalService.submitIfRequired(
      user,
      "DEPARTMENT",
      "UPDATE",
      { id, toggle: true },
      { entityId: id, entityLabel: department.name },
    );
    if (approval) return { success: true, pendingApproval: true, requestId: approval.id };

    const updated = await prisma.department.update({
      where: { id },
      data: { isActive: !department.isActive },
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: "DEPARTMENT_STATUS_TOGGLED",
      entityType: "Department",
      entityId: id,
      metadata: { newStatus: updated.isActive },
    });

    revalidatePath("/admin/departments");
    return { success: true, isActive: updated.isActive };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to toggle department status",
    };
  }
}

// ==========================================
// TASK TYPES CRUD (Super Admin Controlled)
// ==========================================

export async function createTaskTypeAction(data: any) {
  try {
    const user = await requireAuth();
    if (
      !isPlatformSuperAdmin(user) &&
      !hasPermission(user, PERMISSIONS.TASK_TYPES_MANAGE)
    ) {
      return {
        success: false,
        error: "Forbidden: Super Admin access required",
      };
    }

    const validated = taskTypeSchema.parse(data);
    const organizationId = requireOrganizationId(user);

    const memberIds = validated.members.map((member) => member.userId);
    if (new Set(memberIds).size !== memberIds.length)
      return {
        success: false,
        error: "Duplicate team members are not allowed",
      };

    const taskType = await prisma.$transaction(async (tx) => {
      const department = await tx.department.findFirst({
        where: { id: validated.departmentId, organizationId },
        select: { id: true },
      });
      if (!department) throw new Error("Department not found");
      const users = await tx.user.findMany({
        where: {
          id: { in: memberIds },
          departmentId: department.id,
          organizationMemberships: {
            some: { organizationId, status: "ACTIVE" },
          },
        },
        select: { id: true },
      });
      if (users.length !== memberIds.length)
        throw new Error(
          "Every team member must belong to the selected department",
        );

      const generatedCode = `TASK_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const created = await tx.taskType.create({
        data: {
          name: validated.name,
          code: generatedCode,
          departmentId: validated.departmentId,
          description: validated.description || null,
          isActive:
            validated.isActive !== undefined ? validated.isActive : true,
          createdById: user.id,
          organizationId,
          members: {
            create: validated.members.map((member) => ({
              userId: member.userId,
              responsibility: member.responsibility,
            })),
          },
        },
        include: {
          department: true,
          members: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
      return created;
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: "TASK_TYPE_CREATED",
      entityType: "TaskType",
      entityId: taskType.id,
      metadata: {
        name: taskType.name,
        departmentId: taskType.departmentId,
        membersCount: taskType.members.length,
      },
    });

    revalidatePath("/admin/task-types");
    return { success: true, taskType };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to create task type",
    };
  }
}

export async function updateTaskTypeAction(id: string, data: any) {
  try {
    const user = await requireAuth();
    if (
      !isPlatformSuperAdmin(user) &&
      !hasPermission(user, PERMISSIONS.TASK_TYPES_MANAGE)
    ) {
      return {
        success: false,
        error: "Forbidden: Super Admin access required",
      };
    }

    const validated = taskTypeSchema.parse(data);
    const organizationId = requireOrganizationId(user);

    const memberIds = validated.members.map((member) => member.userId);
    if (new Set(memberIds).size !== memberIds.length)
      return {
        success: false,
        error: "Duplicate team members are not allowed",
      };

    const taskType = await prisma.$transaction(async (tx) => {
      const department = await tx.department.findFirst({
        where: { id: validated.departmentId, organizationId },
        select: { id: true },
      });
      if (!department) throw new Error("Department not found");
      const users = await tx.user.findMany({
        where: {
          id: { in: memberIds },
          departmentId: department.id,
          organizationMemberships: {
            some: { organizationId, status: "ACTIVE" },
          },
        },
        select: { id: true },
      });
      if (users.length !== memberIds.length)
        throw new Error(
          "Every team member must belong to the selected department",
        );
      const existing = await tx.taskType.findFirst({
        where: { id, organizationId },
        select: { id: true },
      });
      if (!existing) throw new Error("Task type not found");
      return tx.taskType.update({
        where: { id: existing.id },
        data: {
          name: validated.name,
          departmentId: validated.departmentId,
          description: validated.description || null,
          isActive:
            validated.isActive !== undefined ? validated.isActive : true,
          members: {
            deleteMany: {},
            create: validated.members.map((member) => ({
              userId: member.userId,
              responsibility: member.responsibility,
            })),
          },
        },
        include: {
          department: true,
          members: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: "TASK_TYPE_UPDATED",
      entityType: "TaskType",
      entityId: taskType.id,
      metadata: {
        name: taskType.name,
        departmentId: taskType.departmentId,
        membersCount: taskType.members.length,
        isActive: taskType.isActive,
      },
    });

    revalidatePath("/admin/task-types");
    return { success: true, taskType };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to update task type",
    };
  }
}

export async function deleteTaskTypeAction(id: string) {
  try {
    const user = await requireAuth();
    if (!isPlatformSuperAdmin(user) && user.role !== "SUPER_ADMIN") {
      return {
        success: false,
        error: "Forbidden: Only Super Admin can delete or archive task types",
      };
    }

    const organizationId = requireOrganizationId(user);
    const taskType = await prisma.taskType.findFirst({
      where: { id, organizationId },
      include: {
        _count: {
          select: { tickets: true },
        },
      },
    });

    if (!taskType) {
      return { success: false, error: "Task type not found" };
    }

    // Safety check: If task type has existing tickets, deactivate/archive instead of hard deleting to preserve legacy references
    if (taskType._count.tickets > 0) {
      await prisma.taskType.update({
        where: { id },
        data: { isActive: false },
      });

      await AuditService.logAudit({
        actorId: user.id,
        action: "TASK_TYPE_DEACTIVATED",
        entityType: "TaskType",
        entityId: id,
        metadata: {
          reason: "Safe archive due to existing tickets",
          ticketsCount: taskType._count.tickets,
        },
      });

      revalidatePath("/admin/task-types");
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
      action: "TASK_TYPE_DELETED",
      entityType: "TaskType",
      entityId: id,
      metadata: { name: taskType.name, departmentId: taskType.departmentId },
    });

    revalidatePath("/admin/task-types");
    return {
      success: true,
      deactivated: false,
      message: `Task type "${taskType.name}" deleted successfully.`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to delete task type",
    };
  }
}

export async function toggleTaskTypeStatusAction(id: string) {
  try {
    const user = await requireAuth();
    if (!isPlatformSuperAdmin(user) && user.role !== "SUPER_ADMIN") {
      return {
        success: false,
        error: "Forbidden: Only Super Admin can modify task type status",
      };
    }

    const organizationId = requireOrganizationId(user);
    const taskType = await prisma.taskType.findFirst({
      where: { id, organizationId },
    });
    if (!taskType) return { success: false, error: "Task type not found" };

    const updated = await prisma.taskType.update({
      where: { id },
      data: { isActive: !taskType.isActive },
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: "TASK_TYPE_STATUS_TOGGLED",
      entityType: "TaskType",
      entityId: id,
      metadata: { newStatus: updated.isActive },
    });

    revalidatePath("/admin/task-types");
    return { success: true, isActive: updated.isActive };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to toggle task type status",
    };
  }
}

// ==========================================
// ROLES & PERMISSIONS MANAGEMENT
// ==========================================

type RoleDefinitionInput = {
  displayName: string;
  description?: string;
  permissionIds?: string[];
};

function cleanPermissionIds(permissionIds: string[] = []) {
  return Array.from(new Set(permissionIds.filter((id) => typeof id === "string" && id.trim())));
}

async function validateRolePermissionIds(
  actor: Awaited<ReturnType<typeof requireAuth>>,
  permissionIds: string[],
) {
  const ids = cleanPermissionIds(permissionIds);
  const permissions = await prisma.permission.findMany({
    where: { id: { in: ids } },
    select: { id: true, code: true },
  });

  if (permissions.length !== ids.length) {
    throw new Error("One or more permissions are invalid");
  }

  // Company administrators can delegate only permissions they themselves
  // possess. This prevents a custom role from bypassing plan entitlements or
  // the administrator's own access boundary.
  if (!isPlatformSuperAdmin(actor)) {
    const allowedCodes = actor.role === "SUPER_ADMIN"
      ? filterPermissionsForPlan(permissions.map((permission) => permission.code), actor.planFeatures ?? null)
      : actor.permissions;
    const allowed = new Set(allowedCodes);
    const forbidden = permissions.find((permission) => !allowed.has(permission.code));
    if (forbidden) {
      throw new Error("Permission is not available on the current plan");
    }
  }

  return ids;
}

async function getManagedRole(roleId: string, organizationId: string) {
  return prisma.role.findFirst({
    where: {
      id: roleId,
      OR: [
        { organizationId },
        { organizationId: null },
      ],
    },
    select: {
      id: true,
      name: true,
      displayName: true,
      description: true,
      isSystem: true,
      organizationId: true,
    },
  });
}

export async function createRoleAction(data: RoleDefinitionInput) {
  try {
    const user = await requireAuth();
    const organizationId = requireOrganizationId(user);
    if (!hasPermission(user, PERMISSIONS.ROLES_CREATE)) {
      return { success: false, error: "Forbidden: role creation permission required" };
    }

    const displayName = String(data?.displayName || "").trim();
    const description = String(data?.description || "").trim() || null;
    if (displayName.length < 2 || displayName.length > 80) {
      return { success: false, error: "Role name must be between 2 and 80 characters" };
    }
    if (description && description.length > 240) {
      return { success: false, error: "Role description cannot exceed 240 characters" };
    }

    const duplicate = await prisma.role.findFirst({
      where: { organizationId, displayName },
      select: { id: true },
    });
    if (duplicate) {
      return { success: false, error: "A role with this name already exists in this organization" };
    }

    const permissionIds = await validateRolePermissionIds(user, data?.permissionIds || []);
    const role = await prisma.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: {
          name: `CUSTOM_${organizationId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          displayName,
          description,
          isSystem: false,
          organizationId,
        },
      });
      if (permissionIds.length) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId: created.id, permissionId })),
        });
      }
      return created;
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: "ROLE_CREATED",
      entityType: "Role",
      entityId: role.id,
      metadata: { displayName, permissionCount: permissionIds.length, organizationId },
    });

    revalidatePath("/admin/roles");
    revalidatePath("/admin/users");
    return { success: true, role };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create role" };
  }
}

export async function updateRoleAction(
  roleId: string,
  data: Pick<RoleDefinitionInput, "displayName" | "description">,
) {
  try {
    const user = await requireAuth();
    const organizationId = requireOrganizationId(user);
    if (!hasPermission(user, PERMISSIONS.ROLES_UPDATE)) {
      return { success: false, error: "Forbidden: role update permission required" };
    }
    const role = await getManagedRole(roleId, organizationId);
    if (!role || role.isSystem || role.organizationId !== organizationId) {
      return { success: false, error: "Only custom roles in your organization can be edited" };
    }

    const displayName = String(data?.displayName || "").trim();
    const description = String(data?.description || "").trim() || null;
    if (displayName.length < 2 || displayName.length > 80) {
      return { success: false, error: "Role name must be between 2 and 80 characters" };
    }
    if (description && description.length > 240) {
      return { success: false, error: "Role description cannot exceed 240 characters" };
    }
    const duplicate = await prisma.role.findFirst({
      where: { organizationId, displayName, id: { not: roleId } },
      select: { id: true },
    });
    if (duplicate) return { success: false, error: "A role with this name already exists in this organization" };

    const updated = await prisma.role.update({
      where: { id: roleId },
      data: { displayName, description },
    });
    await AuditService.logAudit({
      actorId: user.id,
      action: "ROLE_UPDATED",
      entityType: "Role",
      entityId: roleId,
      metadata: { displayName, organizationId },
    });
    revalidatePath("/admin/roles");
    revalidatePath("/admin/users");
    return { success: true, role: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update role" };
  }
}

export async function deleteRoleAction(roleId: string) {
  try {
    const user = await requireAuth();
    const organizationId = requireOrganizationId(user);
    if (!hasPermission(user, PERMISSIONS.ROLES_DELETE)) {
      return { success: false, error: "Forbidden: role deletion permission required" };
    }
    const role = await getManagedRole(roleId, organizationId);
    if (!role || role.isSystem || role.organizationId !== organizationId) {
      return { success: false, error: "Only custom roles in your organization can be deleted" };
    }

    const [memberCount, inviteCount] = await Promise.all([
      prisma.organizationMember.count({ where: { roleId, organizationId, status: { not: "REMOVED" } } }),
      prisma.organizationInvite.count({ where: { roleId, organizationId } }),
    ]);
    if (memberCount || inviteCount) {
      return {
        success: false,
        error: "Remove this role from active users and pending invitations before deleting it",
      };
    }

    await prisma.role.delete({ where: { id: roleId } });
    await AuditService.logAudit({
      actorId: user.id,
      action: "ROLE_DELETED",
      entityType: "Role",
      entityId: roleId,
      metadata: { displayName: role.displayName, organizationId },
    });
    revalidatePath("/admin/roles");
    revalidatePath("/admin/users");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete role" };
  }
}

export async function updateRolePermissionsAction(
  roleId: string,
  permissionIds: string[],
) {
  try {
    const user = await requireAuth();
    const organizationId = requireOrganizationId(user);
    if (!hasPermission(user, PERMISSIONS.ROLES_UPDATE)) {
      return { success: false, error: "Forbidden: role update permission required" };
    }
    const role = await getManagedRole(roleId, organizationId);
    if (!role) return { success: false, error: "Role not found" };
    if (role.isSystem && !isPlatformSuperAdmin(user)) {
      return { success: false, error: "System roles cannot be edited from a company account" };
    }
    if (role.isSystem && ["PLATFORM_ADMIN", "SUPER_ADMIN"].includes(role.name)) {
      return { success: false, error: "Protected system roles cannot be edited" };
    }
    if (!role.isSystem && role.organizationId !== organizationId && !isPlatformSuperAdmin(user)) {
      return { success: false, error: "This role does not belong to the active organization" };
    }
    const validatedPermissionIds = await validateRolePermissionIds(user, permissionIds);

    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (validatedPermissionIds.length) {
        await tx.rolePermission.createMany({
          data: validatedPermissionIds.map((permissionId) => ({ roleId, permissionId })),
        });
      }
    });

    await AuditService.logAudit({
      actorId: user.id,
      action: "ROLE_PERMISSIONS_UPDATED",
      entityType: "Role",
      entityId: roleId,
      metadata: { permissionCount: validatedPermissionIds.length },
    });

    revalidatePath("/admin/roles");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function listUserPermissionsAction(userId: string) {
  try {
    const actor = await requireAuth();
    const organizationId = requireOrganizationId(actor);
    if (!hasPermission(actor, PERMISSIONS.USERS_MANAGE_PERMISSIONS))
      return { success: false, error: "Forbidden" };
    const target = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationMemberships: { some: { organizationId, status: "ACTIVE" } },
      },
      select: {
        id: true,
        isPlatformAdmin: true,
        role: { select: { name: true } },
      },
    });
    if (!target) return { success: false, error: "User not found" };
    if (!canManageProtectedAccount(actor, target))
      return {
        success: false,
        error: "Platform administrator accounts are protected",
      };
    const permissions = await prisma.userPermission.findMany({
      where: { userId },
      include: { permission: true },
      orderBy: { permission: { module: "asc" } },
    });
    return { success: true, permissions };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to load user permissions",
    };
  }
}

export async function updateUserPermissionsAction(
  userId: string,
  permissionIds: string[],
) {
  try {
    const actor = await requireAuth();
    const organizationId = requireOrganizationId(actor);
    if (!hasPermission(actor, PERMISSIONS.USERS_MANAGE_PERMISSIONS))
      return { success: false, error: "Forbidden" };
    if (userId === actor.id)
      return {
        success: false,
        error: "You cannot change your own permissions",
      };
    const target = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationMemberships: { some: { organizationId, status: "ACTIVE" } },
      },
      select: {
        id: true,
        isPlatformAdmin: true,
        role: { select: { name: true } },
      },
    });
    if (!target) return { success: false, error: "User not found" };
    if (!canManageProtectedAccount(actor, target))
      return {
        success: false,
        error: "Platform administrator accounts are protected",
      };
    const ids = Array.from(
      new Set(
        permissionIds.filter((id) => typeof id === "string" && id.length > 0),
      ),
    );
    const valid = await prisma.permission.count({ where: { id: { in: ids } } });
    if (valid !== ids.length)
      return { success: false, error: "One or more permissions are invalid" };
    if (!isPlatformSuperAdmin(actor)) {
      const delegated = await prisma.permission.findMany({
        where: { id: { in: ids } },
        select: { code: true },
      });
      const actorPermissions = new Set(actor.permissions);
      if (
        delegated.some((permission) => !actorPermissions.has(permission.code))
      ) {
        return {
          success: false,
          error: "You cannot grant permissions you do not possess",
        };
      }
    }
    await prisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({ where: { userId } });
      if (ids.length)
        await tx.userPermission.createMany({
          data: ids.map((permissionId) => ({ userId, permissionId })),
        });
    });
    await AuditService.logAudit({
      actorId: actor.id,
      action: "USER_PERMISSIONS_UPDATED",
      entityType: "User",
      entityId: userId,
      metadata: { permissionIds: ids, permissionCount: ids.length },
    });
    revalidatePath("/admin/users");
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to update user permissions",
    };
  }
}
