// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import React from 'react';

const routerReplace = vi.fn();
const routerPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace, push: routerPush }),
}));

const resetPasswordAction = vi.fn();
const checkResetTokenAction = vi.fn();
vi.mock('@/server/actions/auth', () => ({
  resetPasswordAction: (...args: any[]) => resetPasswordAction(...args),
  checkResetTokenAction: (...args: any[]) => checkResetTokenAction(...args),
}));

import { I18nProvider } from '@/lib/i18n/context';
import ResetPasswordPage from '@/app/(auth)/reset-password/page';

function setUrl(query: string) {
  window.history.pushState({}, '', `/reset-password${query}`);
}

function renderPage() {
  return render(<I18nProvider><ResetPasswordPage /></I18nProvider>);
}

async function waitForForm() {
  return waitFor(() => {
    const els = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
    if (els.length < 2) throw new Error('password inputs not rendered yet');
    return els;
  });
}

async function fillAndSubmit(password: string, confirm: string) {
  const inputs = await waitForForm();
  fireEvent.change(inputs[0], { target: { value: password } });
  fireEvent.change(inputs[1], { target: { value: confirm } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button'));
    await Promise.resolve();
  });
}

describe('ResetPasswordPage — one-time link enforcement & redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    checkResetTokenAction.mockResolvedValue('VALID');
    setUrl('?token=valid-raw-token');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('checks the token status on mount before showing the form (not just on submit)', async () => {
    renderPage();
    await waitFor(() => expect(checkResetTokenAction).toHaveBeenCalledWith('valid-raw-token'));
    await waitForForm();
  });

  it('redirects to /login via router.replace (not push) only after the server confirms success, after a brief delay', async () => {
    resetPasswordAction.mockResolvedValue({ success: true });
    renderPage();

    await fillAndSubmit('LongEnough1', 'LongEnough1');

    await waitFor(() => expect(resetPasswordAction).toHaveBeenCalledWith('valid-raw-token', 'LongEnough1', 'LongEnough1'));

    // Immediately after success, no navigation should have happened yet — brief success feedback must show first.
    expect(routerReplace).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
    expect(screen.getByText(/Redirecting to login|جارٍ تحويلك إلى تسجيل الدخول/i)).toBeTruthy();

    await vi.advanceTimersByTimeAsync(1500);

    expect(routerReplace).toHaveBeenCalledTimes(1);
    expect(routerReplace).toHaveBeenCalledWith('/login');
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('shows the invalid-link screen immediately when the token is unknown, and never calls the server or redirects', async () => {
    checkResetTokenAction.mockResolvedValue('INVALID');
    renderPage();
    expect(await screen.findByText(/This password reset link is invalid|رابط إعادة تعيين كلمة المرور غير صالح\./i)).toBeTruthy();
    expect(document.querySelectorAll('input[type="password"]').length).toBe(0);
    expect(resetPasswordAction).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3000);
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('shows the expired-link screen immediately for an expired token, without ever showing the form', async () => {
    checkResetTokenAction.mockResolvedValue('EXPIRED');
    renderPage();
    expect(await screen.findByText(/has expired|انتهت صلاحية/i)).toBeTruthy();
    expect(document.querySelectorAll('input[type="password"]').length).toBe(0);
    expect(resetPasswordAction).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3000);
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('shows the already-used screen immediately for a consumed token, without ever showing the form', async () => {
    checkResetTokenAction.mockResolvedValue('ALREADY_USED');
    renderPage();
    expect(await screen.findByText(/already been used|تم استخدام رابط/i)).toBeTruthy();
    expect(document.querySelectorAll('input[type="password"]').length).toBe(0);
    expect(resetPasswordAction).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3000);
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('does NOT redirect and does NOT call the server when passwords do not match (client-side validation)', async () => {
    renderPage();
    await fillAndSubmit('LongEnough1', 'Different1');
    expect(resetPasswordAction).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3000);
    expect(routerReplace).not.toHaveBeenCalled();
    expect(screen.getByText(/do not match|غير متطابقين/i)).toBeTruthy();
  });

  it('does NOT redirect when the password is too short (client-side validation)', async () => {
    renderPage();
    await fillAndSubmit('short1', 'short1');
    expect(resetPasswordAction).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3000);
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('does NOT redirect when the server reports the token was already used, and replaces the form with the dedicated screen so it cannot be resubmitted', async () => {
    resetPasswordAction.mockResolvedValue({ success: false, error: 'TOKEN_ALREADY_USED' });
    renderPage();
    await fillAndSubmit('LongEnough1', 'LongEnough1');
    await waitFor(() => expect(resetPasswordAction).toHaveBeenCalledTimes(1));

    // The form must disappear — there is no way for the user to submit this token again.
    await waitFor(() => expect(document.querySelectorAll('input[type="password"]').length).toBe(0));
    expect(screen.getByText(/already been used|تم استخدام رابط/i)).toBeTruthy();

    await vi.advanceTimersByTimeAsync(3000);
    expect(routerReplace).not.toHaveBeenCalled();
    expect(resetPasswordAction).toHaveBeenCalledTimes(1);
  });

  it('does NOT redirect when the token expires between the initial check and submission, and switches to the expired screen', async () => {
    resetPasswordAction.mockResolvedValue({ success: false, error: 'TOKEN_EXPIRED' });
    renderPage();
    await fillAndSubmit('LongEnough1', 'LongEnough1');
    await waitFor(() => expect(document.querySelectorAll('input[type="password"]').length).toBe(0));
    expect(screen.getByText(/has expired|انتهت صلاحية/i)).toBeTruthy();
    await vi.advanceTimersByTimeAsync(3000);
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('does NOT redirect when the server/database operation fails, and keeps the form available to retry', async () => {
    resetPasswordAction.mockResolvedValue({ success: false, error: 'RESET_FAILED' });
    renderPage();
    await fillAndSubmit('LongEnough1', 'LongEnough1');
    await waitFor(() => expect(resetPasswordAction).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(3000);
    expect(routerReplace).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
    // A transient server failure is retryable — the form must still be present.
    expect(document.querySelectorAll('input[type="password"]').length).toBe(2);
  });

  it('shows the missing-link error immediately and never redirects when there is no token at all', async () => {
    setUrl('');
    renderPage();
    expect(await screen.findByText(/This password reset link is invalid|رابط إعادة تعيين كلمة المرور غير صالح\./i)).toBeTruthy();
    expect(checkResetTokenAction).not.toHaveBeenCalled();
    expect(resetPasswordAction).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3000);
    expect(routerReplace).not.toHaveBeenCalled();
  });
});
