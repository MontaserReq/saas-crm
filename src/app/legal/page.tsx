import type { Metadata } from 'next';
import { LegalIndex } from '@/components/legal/LegalCenter';

export const metadata: Metadata = {
  title: 'Legal Policies Center | SatrCRM',
  description: 'Draft bilingual legal policies for SatrCRM review.',
  robots: { index: false, follow: false },
};

export default function LegalPoliciesPage() {
  return <LegalIndex />;
}
