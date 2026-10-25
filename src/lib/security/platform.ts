import { UserSession } from '@/types';

/** Platform authority requires both the dedicated role and an explicit server-side marker. */
export function isPlatformAdmin(user: Pick<UserSession, 'role' | 'isPlatformAdmin'> | null | undefined): boolean {
  return user?.role === 'PLATFORM_ADMIN' && user.isPlatformAdmin === true;
}

/** @deprecated Use isPlatformAdmin. Kept temporarily for internal call-site compatibility. */
export const isPlatformSuperAdmin = isPlatformAdmin;

type PersistedPlatformIdentity = {
  isPlatformAdmin: boolean;
  role: { name: string } | null;
};

/** Treat either persisted platform signal as protected so inconsistent rows fail closed. */
export function isProtectedPlatformAccount(target: PersistedPlatformIdentity | null | undefined): boolean {
  return !target || target.isPlatformAdmin === true || target.role?.name === 'PLATFORM_ADMIN';
}

export function canManageProtectedAccount(
  actor: Pick<UserSession, 'role' | 'isPlatformAdmin'> | null | undefined,
  target: PersistedPlatformIdentity | null | undefined,
): boolean {
  return !isProtectedPlatformAccount(target) || isPlatformAdmin(actor);
}
