import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { OrganizationConfigService } from '@/server/services/OrganizationConfigService';
import { TicketPrioritySettings } from '@/components/settings/TicketPrioritySettings';

export default async function TicketPrioritiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const config = await OrganizationConfigService.get(user);
  return <TicketPrioritySettings initialPriorities={config.settings.ticketPriorities as any} />;
}
