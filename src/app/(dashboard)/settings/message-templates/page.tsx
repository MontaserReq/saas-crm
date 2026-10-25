import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getOrganizationMessageTemplatesAction } from '@/server/actions/configuration';
import { MessageTemplatesSettings } from '@/components/settings/MessageTemplatesSettings';

export default async function MessageTemplatesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const result = await getOrganizationMessageTemplatesAction();
  return <MessageTemplatesSettings initialTemplates={(result.templates || []) as any} />;
}
