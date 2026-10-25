// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/context';
import { LegalDocument, LegalIndex } from '@/components/legal/LegalCenter';
import { LEGAL_POLICIES, legalSources, policyBySlug } from '@/lib/legal/policies';

vi.mock('@/components/layout/ThemeToggle', () => ({ ThemeToggle: () => <button type="button">Theme</button> }));

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('legal policy registry', () => {
  it('contains the thirteen required, individually linkable bilingual drafts', () => {
    expect(LEGAL_POLICIES).toHaveLength(13);
    expect(new Set(LEGAL_POLICIES.map(policy => policy.slug)).size).toBe(13);
    expect(new Set(LEGAL_POLICIES.map(policy => policy.id)).size).toBe(13);
    for (const policy of LEGAL_POLICIES) {
      expect(policy.version).toBe('draft-0.1');
      expect(policy.effectiveDate.en).toContain('Not effective');
      expect(policy.effectiveDate.ar).toContain('غير نافذة');
      expect(policy.title.en.trim()).not.toBe('');
      expect(policy.title.ar.trim()).not.toBe('');
      expect(policy.sections.length).toBeGreaterThanOrEqual(3);
      expect(policy.related.every(slug => policyBySlug.has(slug))).toBe(true);
    }
    expect(legalSources.length).toBeGreaterThanOrEqual(6);
  });

  it('renders every document from the index and clearly labels the review status', async () => {
    localStorage.setItem('codeline_lang', 'en');
    const { container } = render(<I18nProvider><LegalIndex /></I18nProvider>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Legal Policies Center' })).toBeTruthy());
    expect(container.querySelector('[dir="ltr"]')).toBeTruthy();
    expect(screen.getAllByText('Review draft').length).toBeGreaterThan(0);
    for (const policy of LEGAL_POLICIES) {
      expect(container.querySelector(`a[href="/legal/${policy.slug}"]`)).toBeTruthy();
    }
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('switches a policy between English LTR and Arabic RTL', async () => {
    localStorage.setItem('codeline_lang', 'en');
    const privacy = policyBySlug.get('privacy')!;
    const { container } = render(<I18nProvider><LegalDocument policy={privacy} /></I18nProvider>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeTruthy());
    expect(container.querySelector('[dir="ltr"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Switch Language' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'سياسة الخصوصية' })).toBeTruthy());
    expect(container.querySelector('[dir="rtl"]')).toBeTruthy();
  });
});
