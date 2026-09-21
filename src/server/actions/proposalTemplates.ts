'use server';

import { requireAuth } from '@/lib/auth/session';
import {
  ProposalTemplateService,
  CreateTemplateInput,
  UpdateTemplateInput,
} from '@/server/services/ProposalTemplateService';
import { revalidatePath } from 'next/cache';

export async function listProposalTemplatesAction(options?: { onlyActive?: boolean }) {
  try {
    const user = await requireAuth();
    const templates = await ProposalTemplateService.listTemplates(user, options);
    return { success: true, templates };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch templates' };
  }
}

export async function getProposalTemplateAction(id: string) {
  try {
    const user = await requireAuth();
    const template = await ProposalTemplateService.getTemplate(user, id);
    return { success: true, template };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch template' };
  }
}

export async function updateProposalTemplateAction(id: string, input: UpdateTemplateInput) {
  try {
    const user = await requireAuth();
    const template = await ProposalTemplateService.updateTemplate(user, id, input);
    revalidatePath('/proposals');
    revalidatePath('/proposals/templates');
    return { success: true, template };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update template' };
  }
}

export async function deleteProposalTemplateAction(id: string) {
  try {
    const user = await requireAuth();
    await ProposalTemplateService.deleteTemplate(user, id);
    revalidatePath('/proposals');
    revalidatePath('/proposals/templates');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete template' };
  }
}