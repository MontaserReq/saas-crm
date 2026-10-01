import { validateAuthSecret } from '@/lib/auth/config';

export async function register() {
  validateAuthSecret();
}
