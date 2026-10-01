import { requireAuth } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { ContactService } from '@/server/services/ContactService';
import { ContactsView } from '@/components/crm/ContactsView';
export default async function ContactsPage() { const user = await requireAuth(); if (!hasPermission(user, PERMISSIONS.SCHOOLS_VIEW)) return null; return <ContactsView contacts={await ContactService.list(user)} />; }
