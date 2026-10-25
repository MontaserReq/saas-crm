import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';

const authState = vi.hoisted(() => ({ current: null as any }));

vi.mock('@/lib/auth/session', () => ({
  requireAuth: vi.fn(async () => authState.current),
  getCurrentUser: vi.fn(async () => authState.current),
  hashPassword: vi.fn(async () => 'test-hash'),
  verifyPassword: vi.fn(async () => false),
  createSession: vi.fn(async () => undefined),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import prisma from '@/lib/db/prisma';
import { createDepartmentAction, updateDepartmentAction, deleteDepartmentAction, createTaskTypeAction, updateTaskTypeAction, deleteTaskTypeAction, updateUserPermissionsAction } from '@/server/actions/admin';
import { createUserAction, getUserForEditAction, updateUserAction, deleteUserAction } from '@/server/actions/users';
import { getMessageTemplatesAction } from '@/server/actions/messages';

const run = process.env.RUN_TENANT_CRUD_DB === '1';

describe.skipIf(!run)('final local tenant CRUD action boundaries', () => {
  let orgA: any;
  let orgB: any;
  let deptA: any;
  let deptB: any;
  let role: any;
  let userA: any;
  let userB: any;
  let platformUser: any;
  let plan: any;
  let platformRoleCreated = false;
  let createdDeptA: any;
  let createdDeptB: any;
  let createdTaskA: any;
  let createdTaskB: any;
  let createdUserA: any;
  let createdUserB: any;
  const suffix = crypto.randomUUID();
  const orgAdminPermissions = [
    'departments.manage', 'task_types.manage', 'users.create', 'users.update',
    'users.manage_roles', 'users.manage_permissions', 'messages.send',
  ];
  const templateCodeA = `LOCAL_TEMPLATE_A_${suffix}`;
  const templateCodeB = `LOCAL_TEMPLATE_B_${suffix}`;

  const organizationAdminSession = (user: any, organizationId: string, department: any) => ({
    id: user.id, name: user.name, email: user.email, role: 'ADMIN', isPlatformAdmin: false, roleDisplayName: 'Organization Admin',
    departmentId: department.id, departmentName: department.name, organizationId, permissions: [...orgAdminPermissions], sessionId: `tenant-session-${suffix}`,
  });
  const platformAdminSession = (organizationId: string, department: any) => ({
    id: platformUser.id, name: platformUser.name, email: platformUser.email, role: 'PLATFORM_ADMIN', isPlatformAdmin: true, roleDisplayName: 'Platform Admin',
    departmentId: department.id, departmentName: department.name, organizationId, permissions: [], sessionId: `platform-session-${suffix}`,
  });

  beforeAll(async () => {
    const databaseUrl = new URL(process.env.DATABASE_URL!);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname)) throw new Error('Integration tests require a local PostgreSQL database');
    await prisma.$connect();
    orgA = await prisma.organization.create({ data: { id: `tenant-org-a-${suffix}`, name: 'Tenant CRUD Org A', slug: `tenant-crud-a-${suffix}` } });
    orgB = await prisma.organization.create({ data: { id: `tenant-org-b-${suffix}`, name: 'Tenant CRUD Org B', slug: `tenant-crud-b-${suffix}` } });
    plan = await prisma.platformPlan.create({ data: { slug: `tenant-crud-${suffix}`, name: 'Tenant CRUD Test', userLimit: 10, features: JSON.stringify(['team']) } });
    await prisma.platformSubscription.createMany({ data: [
      { organizationId: orgA.id, planId: plan.id, status: 'ACTIVE', startsAt: new Date(Date.now() - 60_000) },
      { organizationId: orgB.id, planId: plan.id, status: 'ACTIVE', startsAt: new Date(Date.now() - 60_000) },
    ] });
    role = await prisma.role.create({ data: { name: `TENANT_TEST_ADMIN_${suffix}`, displayName: 'Tenant Test Admin', isSystem: false } });
    let platformRole = await prisma.role.findUnique({ where: { name: 'PLATFORM_ADMIN' } });
    if (!platformRole) {
      platformRole = await prisma.role.create({ data: { name: 'PLATFORM_ADMIN', displayName: 'Platform Admin', isSystem: true } });
      platformRoleCreated = true;
    }
    deptA = await prisma.department.create({ data: { id: `tenant-dept-a-${suffix}`, organizationId: orgA.id, name: 'Tenant CRUD Dept A', code: `TENANT_A_${suffix}` } });
    deptB = await prisma.department.create({ data: { id: `tenant-dept-b-${suffix}`, organizationId: orgB.id, name: 'Tenant CRUD Dept B', code: `TENANT_B_${suffix}` } });
    userA = await prisma.user.create({ data: { id: `tenant-user-a-${suffix}`, name: 'Tenant Admin A', email: `tenant-a-${suffix}@example.test`, passwordHash: 'test-only', roleId: role.id, departmentId: deptA.id } });
    userB = await prisma.user.create({ data: { id: `tenant-user-b-${suffix}`, name: 'Tenant Admin B', email: `tenant-b-${suffix}@example.test`, passwordHash: 'test-only', roleId: role.id, departmentId: deptB.id } });
    platformUser = await prisma.user.create({ data: { id: `tenant-platform-${suffix}`, name: 'Tenant Platform Admin', email: `tenant-platform-${suffix}@example.test`, passwordHash: 'test-only', roleId: platformRole.id, departmentId: deptA.id, isPlatformAdmin: true } });
    await prisma.organizationMember.createMany({ data: [
      { organizationId: orgA.id, userId: userA.id, roleId: role.id, status: 'ACTIVE' },
      { organizationId: orgB.id, userId: userB.id, roleId: role.id, status: 'ACTIVE' },
      { organizationId: orgA.id, userId: platformUser.id, roleId: platformRole.id, status: 'ACTIVE' },
    ] });
  });

  afterAll(async () => {
    if (createdUserA) await prisma.user.delete({ where: { id: createdUserA.id } }).catch(() => undefined);
    if (createdUserB) await prisma.user.delete({ where: { id: createdUserB.id } }).catch(() => undefined);
    if (createdTaskA) await prisma.taskType.delete({ where: { id: createdTaskA.id } }).catch(() => undefined);
    if (createdTaskB) await prisma.taskType.delete({ where: { id: createdTaskB.id } }).catch(() => undefined);
    if (createdDeptA) await prisma.department.delete({ where: { id: createdDeptA.id } }).catch(() => undefined);
    if (createdDeptB) await prisma.department.delete({ where: { id: createdDeptB.id } }).catch(() => undefined);
    await prisma.messageTemplate.deleteMany({ where: { organizationId: { in: [orgA?.id, orgB?.id].filter(Boolean) } } });
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [orgA?.id, orgB?.id].filter(Boolean) } } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [orgA?.id, orgB?.id].filter(Boolean) } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA?.id, userB?.id, platformUser?.id].filter(Boolean) } } });
    await prisma.department.deleteMany({ where: { id: { in: [deptA?.id, deptB?.id].filter(Boolean) } } });
    await prisma.platformSubscription.deleteMany({ where: { organizationId: { in: [orgA?.id, orgB?.id].filter(Boolean) } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA?.id, orgB?.id].filter(Boolean) } } });
    if (plan?.id) await prisma.platformPlan.deleteMany({ where: { id: plan.id } });
    if (role?.id) await prisma.role.deleteMany({ where: { id: role.id } });
    if (platformRoleCreated) await prisma.role.deleteMany({ where: { name: 'PLATFORM_ADMIN', users: { none: {} }, organizationMembers: { none: {} } } });
    await prisma.$disconnect();
  });

  it('verifies department CRUD and tenant-scoped listing', async () => {
    authState.current = organizationAdminSession(userA, orgA.id, deptA);
    const codeA = `LOCAL_A_${Date.now()}`;
    const madeA = await createDepartmentAction({ name: 'Local Department A', code: codeA, isActive: true });
    expect(madeA.success).toBe(true);
    createdDeptA = (madeA as any).department;
    const listA = await prisma.department.findMany({ where: { organizationId: orgA.id } });
    expect(listA.some((x) => x.id === createdDeptA.id)).toBe(true);

    authState.current = organizationAdminSession(userB, orgB.id, deptB);
    const codeB = `LOCAL_B_${Date.now()}`;
    const madeB = await createDepartmentAction({ name: 'Local Department B', code: codeB, isActive: true });
    expect(madeB.success).toBe(true);
    createdDeptB = (madeB as any).department;

    authState.current = organizationAdminSession(userA, orgA.id, deptA);
    const updated = await updateDepartmentAction(createdDeptA.id, { name: 'Local Department A Updated', code: codeA, isActive: true });
    expect(updated.success).toBe(true);
    const crossUpdate = await updateDepartmentAction(createdDeptB.id, { name: 'Cross Department', code: `CROSS_${Date.now()}`, isActive: true });
    expect(crossUpdate.success).toBe(false);
    authState.current = platformAdminSession(orgA.id, deptA);
    const crossDelete = await deleteDepartmentAction(createdDeptB.id);
    expect(crossDelete.success).toBe(false);
    const deleted = await deleteDepartmentAction(createdDeptA.id);
    expect(deleted.success).toBe(true);
    createdDeptA = null;
  });

  it('does not treat an unmarked PLATFORM_ADMIN role as platform authority', async () => {
    authState.current = organizationAdminSession(userA, orgA.id, deptA);
    const created = await createDepartmentAction({ name: 'Marker boundary department', code: `MARKER_${Date.now()}`, isActive: true });
    expect(created.success).toBe(true);
    createdDeptA = (created as any).department;
    authState.current = { ...platformAdminSession(orgA.id, deptA), isPlatformAdmin: false };
    expect((await deleteDepartmentAction(createdDeptA.id)).success).toBe(false);
    expect(await prisma.department.findUnique({ where: { id: createdDeptA.id } })).not.toBeNull();
    authState.current = platformAdminSession(orgA.id, deptA);
    expect((await deleteDepartmentAction(createdDeptA.id)).success).toBe(true);
    createdDeptA = null;
  });

  it('verifies task type CRUD, relation ownership, and tenant-scoped listing', async () => {
    authState.current = organizationAdminSession(userA, orgA.id, deptA);
    const madeA = await createTaskTypeAction({ name: 'Local Task A', departmentId: deptA.id, members: [], isActive: true });
    expect(madeA.success).toBe(true);
    createdTaskA = (madeA as any).taskType;

    authState.current = organizationAdminSession(userB, orgB.id, deptB);
    const madeB = await createTaskTypeAction({ name: 'Local Task B', departmentId: deptB.id, members: [], isActive: true });
    expect(madeB.success).toBe(true);
    createdTaskB = (madeB as any).taskType;

    authState.current = organizationAdminSession(userA, orgA.id, deptA);
    expect((await prisma.taskType.findMany({ where: { organizationId: orgA.id } })).some((x) => x.id === createdTaskA.id)).toBe(true);
    const updated = await updateTaskTypeAction(createdTaskA.id, { name: 'Local Task A Updated', departmentId: deptA.id, members: [], isActive: true });
    expect(updated.success).toBe(true);
    const crossRelation = await createTaskTypeAction({ name: 'Cross Relation', departmentId: deptB.id, members: [], isActive: true });
    expect(crossRelation.success).toBe(false);
    const crossUpdate = await updateTaskTypeAction(createdTaskB.id, { name: 'Cross Task', departmentId: deptA.id, members: [], isActive: true });
    expect(crossUpdate.success).toBe(false);
    authState.current = platformAdminSession(orgA.id, deptA);
    const crossDelete = await deleteTaskTypeAction(createdTaskB.id);
    expect(crossDelete.success).toBe(false);
    expect((await deleteTaskTypeAction(createdTaskA.id)).success).toBe(true);
    createdTaskA = null;
  });

  it('verifies user reads, updates, deletes, membership scope, and permission scope', async () => {
    authState.current = organizationAdminSession(userA, orgA.id, deptA);
    const madeA = await createUserAction({ name: 'Local User A', email: `local-a-${Date.now()}@example.test`, password: 'test-password', roleId: role.id, departmentId: deptA.id, isActive: true, accessMode: 'ANY_IP', allowedIps: [] });
    expect(madeA.success).toBe(true);
    createdUserA = (madeA as any).user;

    authState.current = organizationAdminSession(userB, orgB.id, deptB);
    const madeB = await createUserAction({ name: 'Local User B', email: `local-b-${Date.now()}@example.test`, password: 'test-password', roleId: role.id, departmentId: deptB.id, isActive: true, accessMode: 'ANY_IP', allowedIps: [] });
    expect(madeB.success).toBe(true);
    createdUserB = (madeB as any).user;

    authState.current = organizationAdminSession(userA, orgA.id, deptA);
    expect((await getUserForEditAction(createdUserA.id)).success).toBe(true);
    expect((await getUserForEditAction(createdUserB.id)).success).toBe(false);
    const updated = await updateUserAction(createdUserA.id, { name: 'Local User A Updated', email: createdUserA.email, password: '', roleId: role.id, departmentId: deptA.id, reportsToUserId: null, isActive: true, accessMode: 'ANY_IP', allowedIps: [] });
    expect(updated.success).toBe(true);
    expect((await updateUserAction(createdUserB.id, { name: 'Cross User', email: userB.email, password: '', roleId: role.id, departmentId: deptB.id, reportsToUserId: null, isActive: true, accessMode: 'ANY_IP', allowedIps: [] })).success).toBe(false);
    expect((await updateUserPermissionsAction(createdUserB.id, [])).success).toBe(false);
    authState.current = platformAdminSession(orgA.id, deptA);
    expect((await deleteUserAction(createdUserB.id)).success).toBe(false);
    expect((await deleteUserAction(createdUserA.id)).success).toBe(true);
    createdUserA = null;

    const membersA = await prisma.organizationMember.findMany({ where: { organizationId: orgA.id, status: 'ACTIVE' } });
    const membersB = await prisma.organizationMember.findMany({ where: { organizationId: orgB.id, status: 'ACTIVE' } });
    expect(membersA.every((x) => x.organizationId === orgA.id)).toBe(true);
    expect(membersB.every((x) => x.organizationId === orgB.id)).toBe(true);
  });

  it('verifies message template read/list are server-scoped', async () => {
    await prisma.messageTemplate.upsert({ where: { organizationId_code: { organizationId: orgA.id, code: templateCodeA } }, update: { isActive: true }, create: { code: templateCodeA, organizationId: orgA.id, title: 'A', titleAr: 'A', subject: 'A', subjectAr: 'A', content: 'A', contentAr: 'A' } });
    await prisma.messageTemplate.upsert({ where: { organizationId_code: { organizationId: orgB.id, code: templateCodeB } }, update: { isActive: true }, create: { code: templateCodeB, organizationId: orgB.id, title: 'B', titleAr: 'B', subject: 'B', subjectAr: 'B', content: 'B', contentAr: 'B' } });
    authState.current = organizationAdminSession(userA, orgA.id, deptA);
    const resultA = await getMessageTemplatesAction();
    expect(resultA.success).toBe(true);
    expect(resultA.templates.some((x: any) => x.code === templateCodeA)).toBe(true);
    expect(resultA.templates.some((x: any) => x.code === templateCodeB)).toBe(false);
    authState.current = organizationAdminSession(userB, orgB.id, deptB);
    const resultB = await getMessageTemplatesAction();
    expect(resultB.success).toBe(true);
    expect(resultB.templates.some((x: any) => x.code === templateCodeB)).toBe(true);
    expect(resultB.templates.some((x: any) => x.code === templateCodeA)).toBe(false);
  });
});
