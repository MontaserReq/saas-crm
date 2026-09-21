import { getCurrentUser } from '@/lib/auth/session';
import { redirect, notFound } from 'next/navigation';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { ProposalService } from '@/server/services/ProposalService';
import { ProposalTemplateService } from '@/server/services/ProposalTemplateService';
import { ProposalForm } from '@/components/proposals/ProposalForm';
import prisma from '@/lib/db/prisma';

export default async function ProposalDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  if (!hasPermission(user, PERMISSIONS.PROPOSALS_VIEW)) {
    redirect('/proposals');
  }

  let proposal = null;
  try {
    proposal = await ProposalService.getProposal(user, params.id);
  } catch {
    notFound();
  }

  if (!proposal) {
    notFound();
  }

  const [templates, schools] = await Promise.all([
    ProposalTemplateService.listTemplates(user),
    prisma.school.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true, logoKey: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <ProposalForm
      proposal={proposal}
      templates={templates}
      schools={schools}
      currentUserId={user.id}
    />
  );
}