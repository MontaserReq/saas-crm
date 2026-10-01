import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { DepartmentsClientView } from '@/components/admin/DepartmentsClientView';

export default async function DepartmentsPage() {
  const user = (await getCurrentUser())!;

  if (user.role !== 'SUPER_ADMIN' && !hasPermission(user, PERMISSIONS.DEPARTMENTS_MANAGE)) {
    redirect('/');
  }

  const [departments, users] = await Promise.all([
    prisma.department.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'asc' },
      include: {
        managers: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        _count: {
          select: {
            users: true,
            tickets: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true, organizationMemberships: { some: { organizationId: user.organizationId, status: 'ACTIVE' } } },
      select: { id: true, name: true, email: true, department: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
  ]);

  return <DepartmentsClientView departments={departments as any} users={users} />;
}
