import { requireAuth } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { LeadService } from '@/server/services/LeadService';
import { LeadsView } from '@/components/crm/LeadsView';
export default async function LeadsPage() { const user = await requireAuth(); if (!hasPermission(user, PERMISSIONS.SCHOOLS_VIEW)) return null; return <LeadsView leads={await LeadService.list(user)} />; }
