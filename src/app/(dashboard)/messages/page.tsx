import { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/session';
import { MessageService } from '@/server/services/MessageService';
import { MessagesClientView } from '@/components/messages/MessagesClientView';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

export const metadata: Metadata = {
  title: 'Messages | CodeLine JO',
  description: 'Internal Team Messaging System',
};

export default async function MessagesPage({
  searchParams,
}: {
  searchParams?: { tab?: string; search?: string };
}) {
  const user = await requireAuth();
  if (!hasPermission(user, PERMISSIONS.MESSAGES_VIEW)) return null;

  const [inboxResult, sentResult, unreadCount] = await Promise.all([
    MessageService.listInbox(user.id, {
      search: searchParams?.search,
      pageSize: 50,
    }),
    MessageService.listSent(user.id, {
      search: searchParams?.search,
      pageSize: 50,
    }),
    MessageService.getUnreadCount(user.id),
  ]);

  const initialTab = searchParams?.tab === 'sent' ? 'sent' : 'inbox';

  return (
    <MessagesClientView
      inboxMessages={inboxResult.data}
      sentMessages={sentResult.data}
      unreadCount={unreadCount}
      initialTab={initialTab}
    />
  );
}
