import { getCurrentUser } from '@/lib/auth/session';
import { requireOrganizationId } from '@/lib/auth/organization';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { AuditLogsClientView } from '@/components/admin/AuditLogsClientView';
import { isPlatformSuperAdmin } from '@/lib/security/platform';

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const user = (await getCurrentUser())!;

  if (!hasPermission(user, PERMISSIONS.AUDIT_LOGS_VIEW)) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const page = params.page ? parseInt(params.page, 10) : 1;
  const pageSize = 25;
  const skip = (page - 1) * pageSize;
  const platformView = isPlatformSuperAdmin(user);
  const where = platformView
    ? {}
    : { organizationId: requireOrganizationId(user) };

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { name: true, email: true } },
        organization: { select: { name: true } },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <AuditLogsClientView
      logs={logs}
      total={total}
      page={page}
      totalPages={totalPages}
      platformView={platformView}
    />
  );
}
