'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';
import { READ_ONLY_GRACE_MS, type WorkspaceAccessState } from '@/lib/platform/entitlements';

export function TrialAccessBanner({ state, endsAt }: { state?: WorkspaceAccessState; endsAt?: string | null }) {
  const pathname = usePathname();
  const { language } = useI18n();
  const ar = language === 'ar';
  const isSubscriptionContext = pathname === '/settings/subscription' || pathname === '/trial-expired';
  if (!isSubscriptionContext) return null;
  if (!state?.startsWith('TRIAL') && !state?.startsWith('PAID_')) return null;

  const expires = endsAt ? new Date(endsAt) : null;
  const grace = state === 'TRIAL_READ_ONLY_GRACE' || state === 'PAID_READ_ONLY_GRACE';
  const expired = state === 'TRIAL_EXPIRED' || state === 'PAID_EXPIRED';
  const trial = state.startsWith('TRIAL');
  const remainingMs = expires ? Math.max(0, (grace ? expires.getTime() + READ_ONLY_GRACE_MS : expires.getTime()) - Date.now()) : 0;
  const remainingDays = Math.ceil(remainingMs / 86400000);

  const title = expired
    ? trial
      ? (ar ? 'انتهت الفترة التجريبية' : 'Your trial has expired')
      : (ar ? 'انتهى الاشتراك المدفوع' : 'Your paid subscription has expired')
    : grace
      ? trial
        ? (ar ? `الفترة التجريبية في وضع القراءة فقط — ${remainingDays} يوم متبقٍ` : `Trial read-only grace — ${remainingDays} day${remainingDays === 1 ? '' : 's'} remaining`)
        : (ar ? `الاشتراك المدفوع في وضع القراءة فقط — ${remainingDays} يوم متبقٍ` : `Paid subscription read-only grace — ${remainingDays} day${remainingDays === 1 ? '' : 's'} remaining`)
      : state === 'TRIAL_EXPIRING'
        ? (ar ? 'تنتهي فترتك التجريبية خلال 24 ساعة' : 'Your trial expires within 24 hours')
        : trial
          ? (ar ? `الفترة التجريبية نشطة — ${remainingDays} يوم متبقٍ` : `Trial active — ${remainingDays} day${remainingDays === 1 ? '' : 's'} remaining`)
          : (ar ? 'الاشتراك المدفوع نشط' : 'Paid subscription active');

  return (
    <aside className={`mb-5 rounded-2xl border p-4 text-sm ${expired ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100' : grace || state === 'TRIAL_EXPIRING' ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100' : 'border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-100'}`} dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-black">{title}</p>
          {grace && <p className="mt-1 font-semibold">{ar ? 'يمكنك عرض البيانات المسموح بها فقط؛ جميع عمليات الكتابة محظورة.' : 'You can view permitted data only; all write operations are blocked.'}</p>}
          {expires && <p className="mt-1 opacity-80">{grace ? (ar ? 'تنتهي مهلة القراءة فقط:' : 'Read-only grace ends:') : (ar ? 'وقت الانتهاء:' : 'Expires:')} {new Date(expires.getTime() + (grace ? READ_ONLY_GRACE_MS : 0)).toLocaleString(ar ? 'ar-JO' : 'en-US')}</p>}
        </div>
        <Link href={expired ? '/trial-expired' : '/settings/subscription'} className="rounded-xl bg-violet-600 px-4 py-2 font-bold text-white">{ar ? 'عرض الخطط' : 'View plans'}</Link>
      </div>
    </aside>
  );
}
