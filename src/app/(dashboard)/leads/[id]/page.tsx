import { requireAuth } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { LeadService } from '@/server/services/LeadService';
import { CrmWorkspaceService } from '@/server/services/CrmWorkspaceService';
import { Lead360View } from '@/components/crm/Lead360View';
export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) { const user = await requireAuth(); if (!hasPermission(user, PERMISSIONS.SCHOOLS_VIEW)) return null; const id = (await params).id; const [lead, timeline] = await Promise.all([LeadService.get(user, id), CrmWorkspaceService.timeline(user, 'Lead', id)]); if (!lead) return <main className="p-6">Lead not found</main>; return <Lead360View lead={lead} timeline={timeline.events} />; }
