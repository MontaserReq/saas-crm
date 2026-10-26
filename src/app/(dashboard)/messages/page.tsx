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
  searchParams?: Promise<{ tab?: string; search?: string }>;
}) {
  const user = await requireAuth();
  if (!hasPermission(user, PERMISSIONS.MESSAGES_VIEW)) return null;
  const params = searchParams ? await searchParams : undefined;

  const [inboxResult, sentResult, unreadCount] = await Promise.all([
    MessageService.listInbox(user.id, {
      search: params?.search,
      pageSize: 50,
    }),
    MessageService.listSent(user.id, {
      search: params?.search,
      pageSize: 50,
    }),
    MessageService.getUnreadCount(user.id),
  ]);

  const initialTab = params?.tab === 'sent' ? 'sent' : 'inbox';

  return (
    <div>
      <MessagesClientView
        inboxMessages={inboxResult.data}
        sentMessages={sentResult.data}
        unreadCount={unreadCount}
        initialTab={initialTab}
        canSend={hasPermission(user, PERMISSIONS.MESSAGES_SEND)}
        canDelete={hasPermission(user, PERMISSIONS.MESSAGES_DELETE)}
      />
    </div>
  );
}
