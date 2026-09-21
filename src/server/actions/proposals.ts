'use server';

import { requireAuth } from '@/lib/auth/session';
import { ProposalService, ProposalInput } from '@/server/services/ProposalService';
import { revalidatePath } from 'next/cache';

export async function listProposalsAction(filter?: {
  search?: string;
  status?: string;
  schoolId?: string;
  templateId?: string;
}) {
  try {
    const user = await requireAuth();
    const proposals = await ProposalService.listProposals(user, filter);
    return { success: true, proposals };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch proposals' };
  }
}

export async function getProposalAction(id: string) {
  try {
    const user = await requireAuth();
    const proposal = await ProposalService.getProposal(user, id);
    return { success: true, proposal };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch proposal' };
  }
}

export async function createProposalAction(input: ProposalInput) {
  try {
    const user = await requireAuth();
    const proposal = await ProposalService.createProposal(user, input);
    revalidatePath('/proposals');
    return { success: true, proposal };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create proposal' };
  }
}

export async function updateProposalAction(id: string, input: Partial<ProposalInput>) {
  try {
    const user = await requireAuth();
    const proposal = await ProposalService.updateProposal(user, id, input);
    revalidatePath('/proposals');
    revalidatePath(`/proposals/${id}`);
    return { success: true, proposal };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update proposal' };
  }
}

export async function deleteProposalAction(id: string) {
  try {
    const user = await requireAuth();
    await ProposalService.deleteProposal(user, id);
    revalidatePath('/proposals');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete proposal' };
  }
}

export async function generateProposalAction(id: string) {
  try {
    const user = await requireAuth();
    await ProposalService.generateProposal(user, id);
    revalidatePath('/proposals');
    revalidatePath(`/proposals/${id}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to generate proposal' };
  }
}