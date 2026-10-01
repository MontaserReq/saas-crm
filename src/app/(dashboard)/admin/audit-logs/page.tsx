import { getCurrentUser } from '@/lib/auth/session';
import { requireOrganizationId } from '@/lib/auth/organization';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { AuditLogsClientView } from '@/components/admin/AuditLogsClientView';

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const user = (await getCurrentUser())!;

  if (!hasPermission(user, PERMISSIONS.AUDIT_LOGS_VIEW)) {
    redirect('/');
  }

  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;
  const pageSize = 25;
  const skip = (page - 1) * pageSize;
  const organizationId = requireOrganizationId(user);

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where: { organizationId } }),
    prisma.auditLog.findMany({
      where: { organizationId },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { name: true, email: true } },
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
    />
  );
}
