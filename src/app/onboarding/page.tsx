import type { Metadata } from 'next';
import { Suspense } from 'react';
import OnboardingFlow from '@/components/onboarding/OnboardingFlow';
import { getCurrentUser } from '@/lib/auth/session';
import { OnboardingService } from '@/server/services/OnboardingService';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'ابدأ تجربتك | CodeLine JO',
  description: 'جهّز مساحة عمل CodeLine خلال دقائق.',
};

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  const state = user ? (await OnboardingService.get(user)).state : null;
  if (user && (!state || state.status === 'COMPLETE' || state.ownerId !== user.id)) redirect('/dashboard');
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f7f7fb]" />}>
      <OnboardingFlow initialState={state} />
    </Suspense>
  );
}
