import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { TodoService } from '@/server/services/TodoService';
import { StickyNoteBoard } from '@/components/todos/StickyNoteBoard';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { hasPlanFeature } from '@/lib/platform/entitlements';

export default async function TodosPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (!hasPlanFeature(user, 'todos') || !hasPermission(user, PERMISSIONS.TODO_VIEW)) return null;

  const todos = await TodoService.listTodos(user.id);
  const canManageOwn = hasPermission(user, PERMISSIONS.TODO_MANAGE_OWN);

  return (
    <StickyNoteBoard
      initialTodos={todos as any}
      canCreate={hasPermission(user, PERMISSIONS.TODO_CREATE) || canManageOwn}
      canUpdate={hasPermission(user, PERMISSIONS.TODO_UPDATE) || canManageOwn}
      canDelete={hasPermission(user, PERMISSIONS.TODO_DELETE) || canManageOwn}
    />
  );
}
