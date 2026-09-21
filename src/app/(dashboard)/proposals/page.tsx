import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { ProposalService } from '@/server/services/ProposalService';
import { ProposalTemplateService } from '@/server/services/ProposalTemplateService';
import { ProposalList } from '@/components/proposals/ProposalList';
import prisma from '@/lib/db/prisma';

export default async function ProposalsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  if (!hasPermission(user, PERMISSIONS.PROPOSALS_VIEW)) {
    redirect('/');
  }

  const [proposals, templates, schools] = await Promise.all([
    ProposalService.listProposals(user),
    ProposalTemplateService.listTemplates(user),
    prisma.school.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true, logoKey: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <ProposalList
      proposals={proposals}
      templates={templates}
      schools={schools}
      canCreate={hasPermission(user, PERMISSIONS.PROPOSALS_CREATE)}
      canEdit={hasPermission(user, PERMISSIONS.PROPOSALS_UPDATE)}
      canDelete={hasPermission(user, PERMISSIONS.PROPOSALS_DELETE)}
      canGenerate={hasPermission(user, PERMISSIONS.PROPOSALS_GENERATE)}
      canManageTemplates={
        hasPermission(user, PERMISSIONS.PROPOSALS_TEMPLATE_CREATE) ||
        hasPermission(user, PERMISSIONS.PROPOSALS_TEMPLATE_UPDATE) ||
        hasPermission(user, PERMISSIONS.PROPOSALS_TEMPLATE_DELETE)
      }
    />
  );
}