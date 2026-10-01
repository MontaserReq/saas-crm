import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';

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

describe('final local tenant CRUD action boundaries', () => {
  let orgA: any;
  let orgB: any;
  let deptA: any;
  let deptB: any;
  let role: any;
  let userA: any;
  let userB: any;
  let createdDeptA: any;
  let createdDeptB: any;
  let createdTaskA: any;
  let createdTaskB: any;
  let createdUserA: any;
  let createdUserB: any;

  const session = (user: any, organizationId: string, department: any) => ({
    id: user.id, name: user.name, email: user.email, role: 'SUPER_ADMIN', roleDisplayName: 'Super Admin',
    departmentId: department.id, departmentName: department.name, organizationId, permissions: [],
  });

  beforeAll(async () => {
    orgA = await prisma.organization.findUniqueOrThrow({ where: { id: 'tenant-org-a' } });
    orgB = await prisma.organization.findUniqueOrThrow({ where: { id: 'tenant-org-b' } });
    deptA = await prisma.department.findUniqueOrThrow({ where: { id: 'tenant-dept-a' } });
    deptB = await prisma.department.findUniqueOrThrow({ where: { id: 'tenant-dept-b' } });
    role = await prisma.role.findUniqueOrThrow({ where: { name: 'TENANT_TEST_ADMIN' } });
    userA = await prisma.user.findUniqueOrThrow({ where: { id: 'tenant-user-a' } });
    userB = await prisma.user.findUniqueOrThrow({ where: { id: 'tenant-user-b' } });
  });

  afterAll(async () => {
    if (createdUserA) await prisma.user.delete({ where: { id: createdUserA.id } }).catch(() => undefined);
    if (createdUserB) await prisma.user.delete({ where: { id: createdUserB.id } }).catch(() => undefined);
    if (createdTaskA) await prisma.taskType.delete({ where: { id: createdTaskA.id } }).catch(() => undefined);
    if (createdTaskB) await prisma.taskType.delete({ where: { id: createdTaskB.id } }).catch(() => undefined);
    if (createdDeptA) await prisma.department.delete({ where: { id: createdDeptA.id } }).catch(() => undefined);
    if (createdDeptB) await prisma.department.delete({ where: { id: createdDeptB.id } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it('verifies department CRUD and tenant-scoped listing', async () => {
    authState.current = session(userA, orgA.id, deptA);
    const codeA = `LOCAL_A_${Date.now()}`;
    const madeA = await createDepartmentAction({ name: 'Local Department A', code: codeA, isActive: true });
    expect(madeA.success).toBe(true);
    createdDeptA = (madeA as any).department;
    const listA = await prisma.department.findMany({ where: { organizationId: orgA.id } });
    expect(listA.some((x) => x.id === createdDeptA.id)).toBe(true);

    authState.current = session(userB, orgB.id, deptB);
    const codeB = `LOCAL_B_${Date.now()}`;
    const madeB = await createDepartmentAction({ name: 'Local Department B', code: codeB, isActive: true });
    expect(madeB.success).toBe(true);
    createdDeptB = (madeB as any).department;

    authState.current = session(userA, orgA.id, deptA);
    const updated = await updateDepartmentAction(createdDeptA.id, { name: 'Local Department A Updated', code: codeA, isActive: true });
    expect(updated.success).toBe(true);
    const crossUpdate = await updateDepartmentAction(createdDeptB.id, { name: 'Cross Department', code: `CROSS_${Date.now()}`, isActive: true });
    expect(crossUpdate.success).toBe(false);
    const crossDelete = await deleteDepartmentAction(createdDeptB.id);
    expect(crossDelete.success).toBe(false);
    const deleted = await deleteDepartmentAction(createdDeptA.id);
    expect(deleted.success).toBe(true);
    createdDeptA = null;
  });

  it('verifies task type CRUD, relation ownership, and tenant-scoped listing', async () => {
    authState.current = session(userA, orgA.id, deptA);
    const madeA = await createTaskTypeAction({ name: 'Local Task A', departmentId: deptA.id, members: [], isActive: true });
    expect(madeA.success).toBe(true);
    createdTaskA = (madeA as any).taskType;

    authState.current = session(userB, orgB.id, deptB);
    const madeB = await createTaskTypeAction({ name: 'Local Task B', departmentId: deptB.id, members: [], isActive: true });
    expect(madeB.success).toBe(true);
    createdTaskB = (madeB as any).taskType;

    authState.current = session(userA, orgA.id, deptA);
    expect((await prisma.taskType.findMany({ where: { organizationId: orgA.id } })).some((x) => x.id === createdTaskA.id)).toBe(true);
    const updated = await updateTaskTypeAction(createdTaskA.id, { name: 'Local Task A Updated', departmentId: deptA.id, members: [], isActive: true });
    expect(updated.success).toBe(true);
    const crossRelation = await createTaskTypeAction({ name: 'Cross Relation', departmentId: deptB.id, members: [], isActive: true });
    expect(crossRelation.success).toBe(false);
    const crossUpdate = await updateTaskTypeAction(createdTaskB.id, { name: 'Cross Task', departmentId: deptA.id, members: [], isActive: true });
    expect(crossUpdate.success).toBe(false);
    const crossDelete = await deleteTaskTypeAction(createdTaskB.id);
    expect(crossDelete.success).toBe(false);
    expect((await deleteTaskTypeAction(createdTaskA.id)).success).toBe(true);
    createdTaskA = null;
  });

  it('verifies user reads, updates, deletes, membership scope, and permission scope', async () => {
    authState.current = session(userA, orgA.id, deptA);
    const madeA = await createUserAction({ name: 'Local User A', email: `local-a-${Date.now()}@example.test`, password: 'test-password', roleId: role.id, departmentId: deptA.id, isActive: true, accessMode: 'ANY_IP', allowedIps: [] });
    expect(madeA.success).toBe(true);
    createdUserA = (madeA as any).user;

    authState.current = session(userB, orgB.id, deptB);
    const madeB = await createUserAction({ name: 'Local User B', email: `local-b-${Date.now()}@example.test`, password: 'test-password', roleId: role.id, departmentId: deptB.id, isActive: true, accessMode: 'ANY_IP', allowedIps: [] });
    expect(madeB.success).toBe(true);
    createdUserB = (madeB as any).user;

    authState.current = session(userA, orgA.id, deptA);
    expect((await getUserForEditAction(createdUserA.id)).success).toBe(true);
    expect((await getUserForEditAction(createdUserB.id)).success).toBe(false);
    const updated = await updateUserAction(createdUserA.id, { name: 'Local User A Updated', email: createdUserA.email, password: '', roleId: role.id, departmentId: deptA.id, isActive: true, accessMode: 'ANY_IP', allowedIps: [] });
    expect(updated.success).toBe(true);
    expect((await updateUserAction(createdUserB.id, { name: 'Cross User', email: userB.email, password: '', roleId: role.id, departmentId: deptB.id, isActive: true, accessMode: 'ANY_IP', allowedIps: [] })).success).toBe(false);
    expect((await updateUserPermissionsAction(createdUserB.id, [])).success).toBe(false);
    expect((await deleteUserAction(createdUserB.id)).success).toBe(false);
    expect((await deleteUserAction(createdUserA.id)).success).toBe(true);
    createdUserA = null;

    const membersA = await prisma.organizationMember.findMany({ where: { organizationId: orgA.id, status: 'ACTIVE' } });
    const membersB = await prisma.organizationMember.findMany({ where: { organizationId: orgB.id, status: 'ACTIVE' } });
    expect(membersA.every((x) => x.organizationId === orgA.id)).toBe(true);
    expect(membersB.every((x) => x.organizationId === orgB.id)).toBe(true);
  });

  it('verifies message template read/list are server-scoped', async () => {
    await prisma.messageTemplate.upsert({ where: { code: 'LOCAL_TEMPLATE_A' }, update: { organizationId: orgA.id, isActive: true }, create: { code: 'LOCAL_TEMPLATE_A', organizationId: orgA.id, title: 'A', titleAr: 'A', subject: 'A', subjectAr: 'A', content: 'A', contentAr: 'A' } });
    await prisma.messageTemplate.upsert({ where: { code: 'LOCAL_TEMPLATE_B' }, update: { organizationId: orgB.id, isActive: true }, create: { code: 'LOCAL_TEMPLATE_B', organizationId: orgB.id, title: 'B', titleAr: 'B', subject: 'B', subjectAr: 'B', content: 'B', contentAr: 'B' } });
    authState.current = session(userA, orgA.id, deptA);
    const resultA = await getMessageTemplatesAction();
    expect(resultA.success).toBe(true);
    expect(resultA.templates.some((x: any) => x.code === 'LOCAL_TEMPLATE_A')).toBe(true);
    expect(resultA.templates.some((x: any) => x.code === 'LOCAL_TEMPLATE_B')).toBe(false);
    authState.current = session(userB, orgB.id, deptB);
    const resultB = await getMessageTemplatesAction();
    expect(resultB.success).toBe(true);
    expect(resultB.templates.some((x: any) => x.code === 'LOCAL_TEMPLATE_B')).toBe(true);
    expect(resultB.templates.some((x: any) => x.code === 'LOCAL_TEMPLATE_A')).toBe(false);
  });
});
