import { requireAuth } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { ContactService } from '@/server/services/ContactService';
import { CrmWorkspaceService } from '@/server/services/CrmWorkspaceService';
import { Contact360View } from '@/components/crm/Contact360View';
export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) { const user = await requireAuth(); if (!hasPermission(user, PERMISSIONS.SCHOOLS_VIEW)) return null; const id = (await params).id; const [contact, timeline] = await Promise.all([ContactService.get(user, id), CrmWorkspaceService.timeline(user, 'Contact', id)]); if (!contact) return <main className="p-6">Contact not found</main>; return <Contact360View contact={contact} timeline={timeline.events} />; }
