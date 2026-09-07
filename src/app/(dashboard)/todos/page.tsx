import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { TodoService } from '@/server/services/TodoService';
import { StickyNoteBoard } from '@/components/todos/StickyNoteBoard';

export default async function TodosPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const todos = await TodoService.listTodos(user.id);

  return <StickyNoteBoard initialTodos={todos as any} />;
}
