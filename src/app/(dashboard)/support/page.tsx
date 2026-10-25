import { requireAuth } from '@/lib/auth/session';
import { PlatformSupportService } from '@/server/services/PlatformSupportService';
import { PlatformSupportView } from '@/components/support/PlatformSupportView';

export default async function SupportPage() {
  const user = await requireAuth();
  return <PlatformSupportView data={await PlatformSupportService.list(user)} />;
}
