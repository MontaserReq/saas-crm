import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/session';
import { MessageService } from '@/server/services/MessageService';
import { MessageDetailView } from '@/components/messages/MessageDetailView';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

export const metadata: Metadata = {
  title: 'Message Details | CodeLine JO',
  description: 'Internal Message View',
};

export default async function MessageDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireAuth();
  if (!hasPermission(user, PERMISSIONS.MESSAGES_VIEW)) return null;

  try {
    const message = await MessageService.getMessageById(user, params.id);
    return <MessageDetailView message={message} currentUserId={user.id} />;
  } catch (err: any) {
    if (err.message === 'Message not found' || err.message.includes('Unauthorized')) {
      redirect('/messages');
    }
    throw err;
  }
}
