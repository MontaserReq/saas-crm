import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { PlatformSuperAdminDashboard } from '@/components/admin/PlatformSuperAdminDashboard';
import { isPlatformSuperAdmin } from '@/lib/security/platform';

export default async function SuperAdminPage() {
  const user = await getCurrentUser();

  if (!isPlatformSuperAdmin(user)) {
    redirect('/dashboard');
  }

  const [organizations, activeOrganizations, activeUsers, integrations, openTickets, auditEvents, recentOrganizations, recentAudit] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: true, organizationMemberships: { some: { status: 'ACTIVE' } } } }),
    prisma.externalIntegration.count(),
    prisma.ticket.count({ where: { status: { notIn: ['COMPLETED', 'CLOSED'] } } }),
    prisma.auditLog.count(),
    prisma.organization.findMany({ orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, name: true, slug: true, isActive: true, createdAt: true, _count: { select: { members: true } } } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, action: true, entityType: true, createdAt: true, actor: { select: { name: true } } } }),
  ]);

  return <PlatformSuperAdminDashboard stats={{ organizations, activeOrganizations, activeUsers, integrations, openTickets, auditEvents }} organizations={recentOrganizations.map((org) => ({ ...org, createdAt: org.createdAt.toISOString(), members: org._count.members }))} audit={recentAudit.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }))} />;
}
