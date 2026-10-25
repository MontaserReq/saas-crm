import { validateAuthSecret } from '@/lib/auth/config';
import { validateProductionSecurityConfig } from '@/lib/security/runtimeConfig';

export async function register() {
  validateAuthSecret();
  if (process.env.NEXT_RUNTIME === 'nodejs') validateProductionSecurityConfig();
}
