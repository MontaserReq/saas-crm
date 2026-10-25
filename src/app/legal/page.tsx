import type { Metadata } from 'next';
import { LegalIndex } from '@/components/legal/LegalCenter';

export const metadata: Metadata = {
  title: 'Legal Policies Center | CodeLine CRM',
  description: 'Draft bilingual legal policies for CodeLine CRM review.',
  robots: { index: false, follow: false },
};

export default function LegalPoliciesPage() {
  return <LegalIndex />;
}
