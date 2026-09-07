import { getCurrentUser } from '@/lib/auth/session';
import { ChatClient } from '@/components/chat/ChatClient';

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  return <ChatClient currentUserId={user.id} />;
}
