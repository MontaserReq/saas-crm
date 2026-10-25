import { getCurrentUser } from '@/lib/auth/session';
import { ChatClient } from '@/components/chat/ChatClient';
import { MessageGroupsPanel } from '@/components/messages/MessageGroupsPanel';
import { MessageService } from '@/server/services/MessageService';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { hasPlanFeature } from '@/lib/platform/entitlements';

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user || !hasPlanFeature(user, 'chat') || !hasPermission(user, PERMISSIONS.CHAT_VIEW)) return null;
  const groups = await MessageService.listGroups(user);

  return (
    <div className="space-y-6">
      <MessageGroupsPanel
        groups={groups as any}
        canCreate={hasPermission(user, PERMISSIONS.MESSAGES_GROUPS_CREATE)}
      />
      <ChatClient currentUserId={user.id} />
    </div>
  );
}
