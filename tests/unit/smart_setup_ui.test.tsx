// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { initialSetup } from '@/lib/onboarding/templates';
import { I18nProvider } from '@/lib/i18n/context';
const mocks = vi.hoisted(() => ({ save: vi.fn(), complete: vi.fn(), signup: vi.fn(), event: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock('@/components/layout/ThemeToggle', () => ({ ThemeToggle: () => null }));
vi.mock('@/server/actions/auth', () => ({ registerOrganizationAction: mocks.signup, beginSignupAction: vi.fn().mockResolvedValue({ success: true }) }));
vi.mock('@/server/actions/onboarding', () => ({ saveOnboardingAction: mocks.save, completeOnboardingAction: mocks.complete, onboardingEventAction: mocks.event }));
import OnboardingFlow from '@/components/onboarding/OnboardingFlow';

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); localStorage.setItem('codeline_lang', 'en');
  mocks.save.mockImplementation(async input => ({ success: true, state: { ...initialSetup('owner', 'Example', 'en'), step: input.step, answers: input.answers } }));
  mocks.event.mockResolvedValue({ success: true });
});
afterEach(cleanup);
function setup(step = 1, lang: 'ar' | 'en' = 'en') { localStorage.setItem('codeline_lang', lang); return render(<I18nProvider><OnboardingFlow initialState={{ ...initialSetup('owner', 'Example', lang), step }} /></I18nProvider>); }

describe('Smart Setup bilingual and resumable UI', () => {
  it('renders labelled account fields and validates password confirmation', async () => {
    render(<I18nProvider><OnboardingFlow /></I18nProvider>);
    await waitFor(() => screen.getByLabelText('Your name'));
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Owner' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'owner@example.test' } });
    fireEvent.change(screen.getByLabelText('Password (at least 8 characters)'), { target: { value: 'Example123!' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'OtherPassword123!' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create account' }).closest('form')!);
    expect(screen.getByText('The passwords do not match.')).toBeTruthy(); expect(mocks.signup).not.toHaveBeenCalled();
  });
  it.each(['en', 'ar'] as const)('uses accessible controls and correct %s direction', async language => {
    setup(1, language);
    await waitFor(() => expect(document.querySelector('main')?.getAttribute('dir')).toBe(language === 'ar' ? 'rtl' : 'ltr'));
    expect(screen.getAllByRole('radio')).toHaveLength(7); expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(document.querySelector('[aria-current="step"]')).toBeTruthy();
    expect(mocks.event).toHaveBeenCalledWith('ONBOARDING_RESUMED');
  });
  it('permits clearing the company name without crashing and validates before advancing', async () => {
    setup(); await waitFor(() => screen.getByLabelText('Company or team name'));
    fireEvent.change(screen.getByLabelText('Company or team name'), { target: { value: '' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Continue' }).closest('form')!);
    expect(screen.getByText('Enter a company name with 2–120 characters.')).toBeTruthy(); expect(mocks.save).not.toHaveBeenCalled();
  });
  it('skips optional questions using persisted defaults', async () => {
    setup(2); await waitFor(() => screen.getByRole('button', { name: 'Skip and use recommended defaults' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip and use recommended defaults' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ skipped: true, step: 3, answers: expect.objectContaining({ priority: 'sales', tracking: 'none' }) })));
    expect(screen.getByRole('button', { name: 'Accept setup' })).toBeTruthy();
  });
  it('allows retry after provisioning failure and redirects only after success', async () => {
    mocks.complete.mockResolvedValueOnce({ success: false, error: 'SETUP_RETRY' }).mockResolvedValueOnce({ success: true });
    setup(4); await waitFor(() => screen.getByRole('button', { name: 'Create my workspace' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create my workspace' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy()); expect(mocks.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Create my workspace' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/dashboard'));
  });
  it('offers standard setup without additional screens', async () => {
    mocks.complete.mockResolvedValue({ success: true }); setup(3);
    await waitFor(() => screen.getByRole('button', { name: 'Use standard setup' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use standard setup' }));
    fireEvent.click(screen.getByRole('button', { name: 'Accept setup' }));
    await waitFor(() => screen.getByRole('button', { name: 'Create my workspace' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create my workspace' }));
    await waitFor(() => expect(mocks.complete).toHaveBeenCalledWith({ standard: true }));
  });
  it('selects multiple goals, preserves them on back, and advances through four stages', async () => {
    setup(2); await waitFor(() => screen.getByLabelText('Customer support and tickets'));
    fireEvent.click(screen.getByLabelText('Customer support and tickets'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => screen.getByRole('button', { name: 'Accept setup' }));
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ step: 3, answers: expect.objectContaining({ goals: expect.arrayContaining(['pipelines', 'support']) }) }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => screen.getByLabelText('Customer support and tickets'));
    expect((screen.getByLabelText('Customer support and tickets') as HTMLInputElement).checked).toBe(true);
    expect(document.activeElement?.tagName).toBe('H1');
  });
  it('saves module and pipeline edits and blocks invalid stage names without losing input', async () => {
    setup(3); await waitFor(() => screen.getByLabelText('Stage 1'));
    fireEvent.click(screen.getByLabelText('Appointments'));
    fireEvent.change(screen.getByLabelText('Stage 1'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accept setup' }));
    expect(screen.getByRole('alert')).toBeTruthy(); expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Stage 1'), { target: { value: 'Incoming' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accept setup' }));
    await waitFor(() => screen.getByRole('button', { name: 'Create my workspace' }));
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ step: 4, answers: expect.objectContaining({ modules: expect.arrayContaining(['calendar']), pipelineStages: expect.arrayContaining(['Incoming']) }) }));
  });
});
