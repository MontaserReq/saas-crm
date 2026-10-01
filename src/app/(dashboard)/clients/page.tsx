import { requireAuth } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { ClientService } from '@/server/services/ClientService';
import { ClientsView } from '@/components/clients/ClientsView';

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const user = await requireAuth();
  if (!hasPermission(user, PERMISSIONS.SCHOOLS_VIEW)) return null;
  const params = await searchParams;
  const clients = await ClientService.list(user, { search: params.search });
  return <ClientsView clients={clients} initialSearch={params.search || ''} />;
}
