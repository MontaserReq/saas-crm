'use server';

import { requireAuth } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { ClientService, ClientInput } from '@/server/services/ClientService';
import { LeadService, LeadInput } from '@/server/services/LeadService';
import { ContactService, ContactInput } from '@/server/services/ContactService';
import { revalidatePath } from 'next/cache';

function allowed(user: Awaited<ReturnType<typeof requireAuth>>, permission: string) {
  // Existing tenant deployments have school permissions but not yet separate
  // client permissions. Keep that capability mapping explicit and server-side.
  const fallback: Record<string, string> = {
    view: PERMISSIONS.SCHOOLS_VIEW,
    create: PERMISSIONS.SCHOOLS_CREATE,
    update: PERMISSIONS.SCHOOLS_UPDATE,
    delete: PERMISSIONS.SCHOOLS_DELETE,
  };
  if (!hasPermission(user, permission) && !hasPermission(user, fallback[permission])) throw new Error('Forbidden');
}

export async function listClientsAction(filter?: Parameters<typeof ClientService.list>[1]) {
  try { const user = await requireAuth(); allowed(user, PERMISSIONS.SCHOOLS_VIEW); return { success: true, clients: await ClientService.list(user, filter) }; }
  catch (err: any) { return { success: false, error: err.message || 'Failed to list clients' }; }
}
export async function getClientAction(id: string) {
  try { const user = await requireAuth(); allowed(user, PERMISSIONS.SCHOOLS_VIEW); return { success: true, client: await ClientService.get(user, id) }; }
  catch (err: any) { return { success: false, error: err.message || 'Failed to load client' }; }
}
export async function createClientAction(input: ClientInput) {
  try { const user = await requireAuth(); allowed(user, PERMISSIONS.SCHOOLS_CREATE); const client = await ClientService.create(user, input); revalidatePath('/clients'); return { success: true, client }; }
  catch (err: any) { return { success: false, error: err.message || 'Failed to create client' }; }
}
export async function updateClientAction(id: string, input: Partial<ClientInput>) {
  try { const user = await requireAuth(); allowed(user, PERMISSIONS.SCHOOLS_UPDATE); const client = await ClientService.update(user, id, input); revalidatePath('/clients'); return { success: true, client }; }
  catch (err: any) { return { success: false, error: err.message || 'Failed to update client' }; }
}
export async function deleteClientAction(id: string) {
  try { const user = await requireAuth(); allowed(user, PERMISSIONS.SCHOOLS_DELETE); await ClientService.delete(user, id); revalidatePath('/clients'); return { success: true }; }
  catch (err: any) { return { success: false, error: err.message || 'Failed to archive client' }; }
}

export async function listLeadsAction(filter?: Parameters<typeof LeadService.list>[1]) {
  try { const user = await requireAuth(); allowed(user, PERMISSIONS.SCHOOLS_VIEW); return { success: true, leads: await LeadService.list(user, filter) }; }
  catch (err: any) { return { success: false, error: err.message || 'Failed to list leads' }; }
}
export async function createLeadAction(input: LeadInput) {
  try { const user = await requireAuth(); allowed(user, PERMISSIONS.SCHOOLS_CREATE); return { success: true, lead: await LeadService.create(user, input) }; }
  catch (err: any) { return { success: false, error: err.message || 'Failed to create lead' }; }
}
export async function updateLeadAction(id: string, input: Partial<LeadInput>) {
  try { const user = await requireAuth(); allowed(user, PERMISSIONS.SCHOOLS_UPDATE); return { success: true, lead: await LeadService.update(user, id, input) }; }
  catch (err: any) { return { success: false, error: err.message || 'Failed to update lead' }; }
}
export async function deleteLeadAction(id: string) {
  try { const user = await requireAuth(); allowed(user, PERMISSIONS.SCHOOLS_DELETE); return { success: true, lead: await LeadService.delete(user, id) }; }
  catch (err: any) { return { success: false, error: err.message || 'Failed to delete lead' }; }
}

export async function listContactsAction(filter?: Parameters<typeof ContactService.list>[1]) {
  try { const user = await requireAuth(); allowed(user, PERMISSIONS.SCHOOLS_VIEW); return { success: true, contacts: await ContactService.list(user, filter) }; }
  catch (err: any) { return { success: false, error: err.message || 'Failed to list contacts' }; }
}
export async function createContactAction(input: ContactInput) {
  try { const user = await requireAuth(); allowed(user, PERMISSIONS.SCHOOLS_CREATE); return { success: true, contact: await ContactService.create(user, input) }; }
  catch (err: any) { return { success: false, error: err.message || 'Failed to create contact' }; }
}
export async function updateContactAction(id: string, input: Partial<ContactInput>) {
  try { const user = await requireAuth(); allowed(user, PERMISSIONS.SCHOOLS_UPDATE); return { success: true, contact: await ContactService.update(user, id, input) }; }
  catch (err: any) { return { success: false, error: err.message || 'Failed to update contact' }; }
}
export async function deleteContactAction(id: string) {
  try { const user = await requireAuth(); allowed(user, PERMISSIONS.SCHOOLS_DELETE); return { success: true, contact: await ContactService.delete(user, id) }; }
  catch (err: any) { return { success: false, error: err.message || 'Failed to delete contact' }; }
}
