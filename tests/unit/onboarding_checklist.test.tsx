// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/context';
import { initialSetup, type SetupState } from '@/lib/onboarding/templates';
const mocks = vi.hoisted(() => ({ checklist: vi.fn(), client: vi.fn(), lead: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('@/server/actions/onboarding', () => ({ updateOnboardingChecklistAction: mocks.checklist }));
vi.mock('@/server/actions/crm', () => ({ createClientAction: mocks.client, createLeadAction: mocks.lead }));
import { WorkspaceWelcome } from '@/components/onboarding/WorkspaceWelcome';
beforeEach(() => { vi.clearAllMocks(); localStorage.setItem('codeline_lang', 'en'); });
afterEach(cleanup);
function renderChecklist(patch: Partial<SetupState> = {}, modules = ['dashboard', 'clients', 'pipelines', 'tasks']) {
  const state: SetupState = { ...initialSetup('owner', 'Example', 'en'), status: 'COMPLETE', completedAt: new Date().toISOString(), ...patch };
  mocks.checklist.mockImplementation(async input => ({ success: true, state: { ...state, checklistDismissed: input.dismissed ?? false } }));
  return render(<I18nProvider><WorkspaceWelcome state={state} modules={modules} canCreate canInvite canConfigure canPipeline canTask /></I18nProvider>);
}
describe('Optional getting-started checklist', () => {
  it('dismisses and resumes saved progress without blocking workspace navigation', async () => {
    renderChecklist(); await waitFor(() => screen.getByRole('button', { name: 'Dismiss checklist' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss checklist' }));
    await waitFor(() => screen.getByRole('button', { name: 'Resume getting started' }));
    expect(mocks.checklist).toHaveBeenCalledWith({ dismissed: true });
    fireEvent.click(screen.getByRole('button', { name: 'Resume getting started' }));
    await waitFor(() => screen.getByRole('link', { name: 'Customize your pipeline' }));
    expect(mocks.checklist).toHaveBeenCalledWith({ dismissed: false });
  });
  it('offers only relevant tasks for a solo customer workspace', async () => {
    const answers = { ...initialSetup('owner', 'Example', 'en').answers, teamSize: '1' as const };
    renderChecklist({ answers }, ['dashboard', 'clients']);
    await waitFor(() => screen.getByLabelText('Add your first customer'));
    expect(screen.queryByRole('link', { name: 'Invite a team member' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Customize your pipeline' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Add a follow-up task' })).toBeNull();
  });
  it('retains the checklist after a failed dismiss and renders Arabic RTL', async () => {
    localStorage.setItem('codeline_lang', 'ar'); renderChecklist();
    mocks.checklist.mockResolvedValueOnce({ success: false });
    await waitFor(() => screen.getByRole('button', { name: 'إخفاء قائمة البداية' }));
    fireEvent.click(screen.getByRole('button', { name: 'إخفاء قائمة البداية' }));
    await waitFor(() => screen.getByRole('alert'));
    expect(document.querySelector('section')?.getAttribute('dir')).toBe('rtl');
    expect(screen.getByRole('button', { name: 'إخفاء قائمة البداية' })).toBeTruthy();
  });
});
