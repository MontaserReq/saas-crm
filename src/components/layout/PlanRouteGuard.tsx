'use client';

import Link from 'next/link';
import { LockKeyhole } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';
import { featureForRoute, isRouteIncluded, planFeatureLabels } from '@/lib/platform/entitlements';

export function PlanRouteGuard({ features, children, bypassPlanGuard = false }: { features: string[] | null; children: React.ReactNode; bypassPlanGuard?: boolean }) {
  const pathname = usePathname();
  const { language } = useI18n(); const ar = language === 'ar';
  if (bypassPlanGuard || isRouteIncluded(pathname, features)) return children;
  const feature = featureForRoute(pathname);
  return <section className="mx-auto mt-10 max-w-xl rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm dark:border-amber-900/60 dark:bg-slate-900" dir={ar ? 'rtl' : 'ltr'}>
    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300"><LockKeyhole className="h-6 w-6" /></span>
    <h1 className="mt-5 text-2xl font-black">{ar ? 'هذه الميزة غير مشمولة في خطتك' : 'This feature is not included in your plan'}</h1>
    <p className="mt-3 text-sm leading-6 text-slate-500">{feature ? planFeatureLabels[feature][language] : ''} {ar ? 'يمكنك طلب ترقية وسيقوم مدير المنصة بمراجعتها.' : 'You can request an upgrade for review by the platform administrator.'}</p>
    <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/settings/subscription" className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white">{ar ? 'عرض خطتي وطلب ترقية' : 'View my plan & request upgrade'}</Link><Link href="/dashboard" className="rounded-xl border px-5 py-3 text-sm font-bold">{ar ? 'العودة للوحة التحكم' : 'Back to dashboard'}</Link></div>
  </section>;
}
