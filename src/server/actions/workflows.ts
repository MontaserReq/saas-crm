'use server';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { WorkflowService } from '@/server/services/WorkflowService';
function guard(user: Awaited<ReturnType<typeof requireAuth>>, permission: string) { if (!hasPermission(user, permission)) throw new Error('Forbidden'); }
export async function listWorkflowsAction() { try { const u = await requireAuth(); guard(u, PERMISSIONS.WORKFLOWS_VIEW); return { success: true, workflows: await WorkflowService.list(u) }; } catch (e: any) { return { success: false, error: e.message }; } }
export async function createWorkflowAction(input: any) { try { const u = await requireAuth(); guard(u, PERMISSIONS.WORKFLOWS_CREATE); const workflow = await WorkflowService.create(u, input); revalidatePath('/settings/workflows'); return { success: true, workflow }; } catch (e: any) { return { success: false, error: e.message }; } }
export async function updateWorkflowAction(id: string, input: any) { try { const u = await requireAuth(); guard(u, PERMISSIONS.WORKFLOWS_UPDATE); const workflow = await WorkflowService.update(u, id, input); revalidatePath('/settings/workflows'); return { success: true, workflow }; } catch (e: any) { return { success: false, error: e.message }; } }
export async function setWorkflowActiveAction(id: string, active: boolean) { try { const u = await requireAuth(); guard(u, PERMISSIONS.WORKFLOWS_ACTIVATE); const workflow = await WorkflowService.setActive(u, id, active); revalidatePath('/settings/workflows'); return { success: true, workflow }; } catch (e: any) { return { success: false, error: e.message }; } }
export async function archiveWorkflowAction(id: string) { try { const u = await requireAuth(); guard(u, PERMISSIONS.WORKFLOWS_ARCHIVE); const workflow = await WorkflowService.archive(u, id); revalidatePath('/settings/workflows'); return { success: true, workflow }; } catch (e: any) { return { success: false, error: e.message }; } }
export async function getWorkflowExecutionsAction(id: string) { try { const u = await requireAuth(); guard(u, PERMISSIONS.WORKFLOW_EXECUTIONS_VIEW); return { success: true, executions: await WorkflowService.executions(u, id) }; } catch (e: any) { return { success: false, error: e.message }; } }
