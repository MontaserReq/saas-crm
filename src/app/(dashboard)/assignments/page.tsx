import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { SchoolAssignmentWizard } from '@/components/assignments/SchoolAssignmentWizard';

export default async function AssignmentsPage() {
  const user = (await getCurrentUser())!;

  if (!hasPermission(user, PERMISSIONS.SCHOOLS_ASSIGN)) {
    redirect('/');
  }

  const [taskTypes, departments, teamMembers, availableSchools] = await Promise.all([
    prisma.taskType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({
      where: {
        isActive: true,
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
      // A responsible employee on the school record does not mean that the
      // school cannot receive a new outreach assignment. Only archived or
      // explicitly inactive schools should be hidden from this workflow.
      where: { isDeleted: false, status: { not: 'INACTIVE' } },
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
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">School Assignment Engine</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Select target schools and distribute them across PR team members. Exactly 1 individual ticket is generated per school with complete audit tracing.
        </p>
      </div>

      <SchoolAssignmentWizard
        taskTypes={taskTypes}
        departments={departments}
        teamMembers={teamMembers}
        availableSchools={availableSchools}
      />
    </div>
  );
}
