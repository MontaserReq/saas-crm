import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { ProposalTemplateService } from '@/server/services/ProposalTemplateService';
import { ProposalForm } from '@/components/proposals/ProposalForm';
import prisma from '@/lib/db/prisma';

export default async function NewProposalPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  if (!hasPermission(user, PERMISSIONS.PROPOSALS_CREATE)) {
    redirect('/proposals');
  }

  const [templates, schools] = await Promise.all([
    ProposalTemplateService.listTemplates(user, { onlyActive: true }),
    prisma.school.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true, logoKey: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <ProposalForm
      templates={templates}
      schools={schools}
      currentUserId={user.id}
    />
  );
}