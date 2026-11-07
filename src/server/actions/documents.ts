'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/session';
import { DocumentService } from '@/server/services/DocumentService';

export async function listDocumentsAction(search?: string) {
  try {
    const user = await requireAuth();
    return { success: true, documents: await DocumentService.list(user, search) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to load documents.' };
  }
}

export async function createDocumentAction(input: unknown) {
  try {
    const user = await requireAuth();
    const document = await DocumentService.create(user, input);
    revalidatePath('/documents');
    return { success: true, document };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to create document.' };
  }
}

export async function updateDocumentAction(documentId: string, input: unknown, createVersion = false) {
  try {
    const user = await requireAuth();
    const document = await DocumentService.update(user, documentId, input, createVersion);
    revalidatePath('/documents');
    revalidatePath(`/documents/${documentId}`);
    return { success: true, document };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to save document.' };
  }
}

export async function archiveDocumentAction(documentId: string) {
  try {
    const user = await requireAuth();
    await DocumentService.archive(user, documentId);
    revalidatePath('/documents');
    revalidatePath(`/documents/${documentId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to archive document.' };
  }
}

export async function shareDocumentAction(documentId: string, input: unknown) {
  try {
    const user = await requireAuth();
    const permission = await DocumentService.share(user, documentId, input);
    revalidatePath(`/documents/${documentId}`);
    return { success: true, permission };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to share document.' };
  }
}

export async function listDocumentMembersAction() {
  try {
    const user = await requireAuth();
    return { success: true, members: await DocumentService.listWorkspaceMembers(user) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to load workspace members.' };
  }
}
