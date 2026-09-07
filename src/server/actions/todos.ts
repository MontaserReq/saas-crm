'use server';

import { requireAuth } from '@/lib/auth/session';
import { TodoService } from '@/server/services/TodoService';
import { revalidatePath } from 'next/cache';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

function canTodo(user: Awaited<ReturnType<typeof requireAuth>>, permission: string) {
  return hasPermission(user, permission) || hasPermission(user, PERMISSIONS.TODO_MANAGE_OWN);
}

export async function createTodoAction(data: any) {
  try {
    const user = await requireAuth();
    if (!canTodo(user, PERMISSIONS.TODO_CREATE)) return { success: false, error: 'Forbidden' };
    const todo = await TodoService.createTodo(user.id, data);
    revalidatePath('/todos');
    return { success: true, todo };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create to-do' };
  }
}

export async function updateTodoAction(id: string, data: any) {
  try {
    const user = await requireAuth();
    if (!canTodo(user, PERMISSIONS.TODO_UPDATE)) return { success: false, error: 'Forbidden' };
    const todo = await TodoService.updateTodo(user.id, id, data);
    revalidatePath('/todos');
    return { success: true, todo };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update to-do' };
  }
}

export async function changeTodoColorAction(id: string, color: string) {
  try {
    const user = await requireAuth();
    if (!canTodo(user, PERMISSIONS.TODO_UPDATE)) return { success: false, error: 'Forbidden' };
    const todo = await TodoService.changeColor(user.id, id, color);
    revalidatePath('/todos');
    return { success: true, todo };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to change note color' };
  }
}

export async function toggleTodoAction(id: string) {
  try {
    const user = await requireAuth();
    if (!canTodo(user, PERMISSIONS.TODO_UPDATE)) return { success: false, error: 'Forbidden' };
    const todo = await TodoService.toggleComplete(user.id, id);
    revalidatePath('/todos');
    return { success: true, todo };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to toggle to-do' };
  }
}

export async function deleteTodoAction(id: string) {
  try {
    const user = await requireAuth();
    if (!canTodo(user, PERMISSIONS.TODO_DELETE)) return { success: false, error: 'Forbidden' };
    await TodoService.deleteTodo(user.id, id);
    revalidatePath('/todos');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete to-do' };
  }
}
