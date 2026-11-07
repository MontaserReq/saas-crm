import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { DocumentService } from '@/server/services/DocumentService';
import { DocumentsView } from '@/components/documents/DocumentsView';

export default async function DocumentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasPermission(user, PERMISSIONS.DOCUMENTS_VIEW)) redirect('/dashboard');
  const documents = await DocumentService.list(user);
  return <DocumentsView documents={documents.map(document => ({ ...document, createdAt: document.createdAt.toISOString(), updatedAt: document.updatedAt.toISOString() }))} canCreate={hasPermission(user, PERMISSIONS.DOCUMENTS_CREATE)} canDelete={hasPermission(user, PERMISSIONS.DOCUMENTS_DELETE)} />;
}
