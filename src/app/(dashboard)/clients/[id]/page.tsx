import { requireAuth } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { ClientService } from '@/server/services/ClientService';
import { CrmWorkspaceService } from '@/server/services/CrmWorkspaceService';
import { Client360View } from '@/components/crm/Client360View';
import { CustomFieldService } from '@/server/services/CustomFieldService';
export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) { const user = await requireAuth(); if (!hasPermission(user, PERMISSIONS.SCHOOLS_VIEW)) return null; const id = (await params).id; const [client, timeline, customFields] = await Promise.all([ClientService.get(user, id), CrmWorkspaceService.timeline(user, 'Client', id), CustomFieldService.getEntityValues(user, 'CLIENT', id)]); if (!client) return <main className="p-6">Client not found</main>; return <Client360View client={client} timeline={timeline.events} customFields={customFields} />; }
