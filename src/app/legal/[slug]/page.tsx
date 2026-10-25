import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalDocument } from '@/components/legal/LegalCenter';
import { LEGAL_POLICIES, policyBySlug } from '@/lib/legal/policies';

export const dynamicParams = false;

export function generateStaticParams() {
  return LEGAL_POLICIES.map(policy => ({ slug: policy.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const policy = policyBySlug.get(slug);
  if (!policy) return {};
  return {
    title: `${policy.title.en} | CodeLine CRM`,
    description: policy.summary.en,
    robots: { index: false, follow: false },
  };
}

export default async function LegalPolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = policyBySlug.get(slug);
  if (!policy) notFound();
  return <LegalDocument policy={policy} />;
}
