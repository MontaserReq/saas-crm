import { getCurrentUser } from '@/lib/auth/session';
import { SchoolService } from '@/server/services/SchoolService';
import { SchoolsClientView } from '@/components/schools/SchoolsClientView';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import prisma from '@/lib/db/prisma';

export default async function SchoolsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const user = (await getCurrentUser())!;
  if (!hasPermission(user, PERMISSIONS.SCHOOLS_VIEW)) return null;

  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;
  const search = searchParams.search || '';
  const classification = searchParams.classification || '';
  const city = searchParams.city || '';

  // Registry visibility is governed by schools.view. Responsible employee and
  // ticket assignment are business data, not access filters.
  const schoolScope = { isDeleted: false };
  const [result, totalAllSchools, totalAssignedSchools, totalClassA, users, pendingRequests] = await Promise.all([
    SchoolService.listSchools({
      page,
      pageSize: 15,
      search,
      classification: classification || undefined,
      city: city || undefined,
    }),
    prisma.school.count({ where: schoolScope }),
    prisma.school.count({ where: { ...schoolScope, status: 'ASSIGNED' } }),
    prisma.school.count({ where: { ...schoolScope, classification: 'A' } }),
    prisma.user.findMany({
      where: { isActive: true, ...(hasPermission(user, PERMISSIONS.SCHOOLS_ASSIGN) ? {} : { id: user.id }) },
      select: { id: true, name: true, email: true, department: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.schoolApprovalRequest.findMany({
      where: { requesterId: user.id, status: 'PENDING' },
      select: { schoolId: true, type: true, createdAt: true },
    }),
  ]);

  const pendingBySchool = new Map<string, any[]>();
  for (const request of pendingRequests) {
    pendingBySchool.set(request.schoolId, [...(pendingBySchool.get(request.schoolId) || []), request]);
  }

  const canCreate = hasPermission(user, PERMISSIONS.SCHOOLS_CREATE);
  const canImport = hasPermission(user, PERMISSIONS.SCHOOLS_IMPORT);
  const canAssign = hasPermission(user, PERMISSIONS.SCHOOLS_ASSIGN);
  const canDelete = hasPermission(user, PERMISSIONS.SCHOOLS_DELETE);

  return (
    <SchoolsClientView
      initialSchools={result.data.map((school: any) => ({ ...school, pendingApprovalRequests: pendingBySchool.get(school.id) || [] }))}
      total={result.total}
      totalAllSchools={totalAllSchools}
      totalAssignedSchools={totalAssignedSchools}
      totalClassA={totalClassA}
      page={result.page}
      totalPages={result.totalPages}
      canCreate={canCreate}
      canImport={canImport}
      canAssign={canAssign}
      canDelete={canDelete}
      initialSearch={search}
      initialCity={city}
      initialClassification={classification}
      users={users}
    />
  );
}
