import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getCurrentUser, redirect } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
}));
vi.mock('@/lib/auth/session', () => ({ getCurrentUser }));
vi.mock('next/navigation', () => ({ redirect }));

import LoginLayout from '@/app/(auth)/login/layout';

describe('login routing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders login when the session is expired, revoked, or missing', async () => {
    getCurrentUser.mockResolvedValue(null);
    expect(await LoginLayout({ children: 'login form' })).toBe('login form');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('sends an authenticated workspace member to the dashboard', async () => {
    getCurrentUser.mockResolvedValue({ role: 'ADMIN', isPlatformAdmin: false });
    await expect(LoginLayout({ children: 'login form' })).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('sends a verified platform administrator to platform administration', async () => {
    getCurrentUser.mockResolvedValue({ role: 'PLATFORM_ADMIN', isPlatformAdmin: true });
    await expect(LoginLayout({ children: 'login form' })).rejects.toThrow('REDIRECT:/admin');
  });
});
