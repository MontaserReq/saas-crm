import { getCurrentUser } from '@/lib/auth/session';
import { isPlatformSuperAdmin } from '@/lib/security/platform';
import { redirect } from 'next/navigation';

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect(isPlatformSuperAdmin(user) ? '/admin' : '/dashboard');
  return children;
}
