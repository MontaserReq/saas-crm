import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { DocumentService } from '@/server/services/DocumentService';
import { DocumentEditor } from '@/components/documents/DocumentEditor';

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasPermission(user, PERMISSIONS.DOCUMENTS_VIEW)) redirect('/dashboard');
  const { id } = await params;
  let document;
  try { document = await DocumentService.get(user, id); } catch { notFound(); }
  const canEdit = !user.workspaceReadOnly && (document.createdById === user.id || hasPermission(user, PERMISSIONS.DOCUMENTS_UPDATE) || document.permissions.some(permission => permission.userId === user.id && permission.role === 'EDITOR'));
  return <DocumentEditor document={{ ...document, updatedAt: document.updatedAt.toISOString(), permissions: document.permissions }} canEdit={canEdit} />;
}
