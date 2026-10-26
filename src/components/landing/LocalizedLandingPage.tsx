'use client';

import { I18nProvider } from '@/lib/i18n/context';
import type { Language } from '@/lib/i18n/translations';
import type { PlanConfig } from '@/lib/plans';
import LandingPage from './LandingPage';

export default function LocalizedLandingPage({
  language,
  plans,
}: {
  language: Language;
  plans: PlanConfig[];
}) {
  return (
    <I18nProvider initialLanguage={language} lockInitialLanguage>
      <LandingPage plans={plans} />
    </I18nProvider>
  );
}
