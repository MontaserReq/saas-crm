import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { SchoolAssignmentWizard } from '@/components/assignments/SchoolAssignmentWizard';
import { AssignmentsPageHeader } from '@/components/assignments/AssignmentsPageHeader';

export default async function AssignmentsPage() {
  const user = (await getCurrentUser())!;

  if (!hasPermission(user, PERMISSIONS.SCHOOLS_ASSIGN)) {
    redirect('/');
  }

  const [taskTypes, departments, teamMembers, availableSchools] = await Promise.all([
    prisma.taskType.findMany({ where: { isActive: true, organizationId: user.organizationId }, orderBy: { name: 'asc' } }),
    prisma.department.findMany({ where: { isActive: true, organizationId: user.organizationId }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({
      where: {
        isActive: true,
        organizationMemberships: { some: { organizationId: user.organizationId, status: 'ACTIVE' } },
        OR: [
          { role: { rolePermissions: { some: { permission: { code: { in: ['tickets.view_assigned', 'tickets.view_all'] } } } } } },
          { userPermissions: { some: { permission: { code: { in: ['tickets.view_assigned', 'tickets.view_all'] } } } } },
        ],
      },
      select: {
        id: true,
        name: true,
        departmentId: true,
        department: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.school.findMany({
      // A responsible employee means the school was already distributed and
      // received its initial ticket during import. It must not be offered again.
      where: { isDeleted: false, organizationId: user.organizationId, status: { not: 'INACTIVE' }, responsibleEmployeeId: null },
      select: {
        id: true,
        name: true,
        city: true,
        schoolType: true,
        status: true,
        responsibleEmployee: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-6">
      <AssignmentsPageHeader />

      <SchoolAssignmentWizard
        taskTypes={taskTypes}
        departments={departments}
        teamMembers={teamMembers}
        availableSchools={availableSchools}
      />
    </div>
  );
}
