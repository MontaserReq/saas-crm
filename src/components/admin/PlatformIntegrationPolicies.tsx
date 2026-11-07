"use client";

import { useState } from 'react';
import { BellRing, Check, PlugZap, ShieldCheck, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { setIntegrationPolicyAction } from '@/server/actions/platform';
import { managedIntegrationCatalog, type ManagedIntegrationProvider } from '@/lib/integrations/catalog';

type Plan = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  included: boolean;
  integrations: Array<{ provider: ManagedIntegrationProvider; enabled: boolean }>;
};

export function PlatformIntegrationPolicies({ plans }: { plans: Plan[] }) {
  const { language } = useI18n();
  const ar = language === 'ar';
  const [items, setItems] = useState(plans);
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const text = (en: string, arabic: string) => ar ? arabic : en;

  async function toggle(planId: string, provider: ManagedIntegrationProvider, enabled: boolean) {
    const key = `${planId}:${provider}`;
    setPending(key); setFeedback(null);
    const result = await setIntegrationPolicyAction({ planId, provider, enabled });
    if (result.success) {
      setItems((current) => current.map((plan) => plan.id !== planId ? plan : ({ ...plan, integrations: plan.integrations.map((item) => item.provider === provider ? { ...item, enabled } : item) })));
      setFeedback(text('Policy saved and affected users were notified.', 'تم حفظ السياسة وإرسال إشعار للمستخدمين المتأثرين.'));
    } else setFeedback(result.error);
    setPending(null);
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6" dir={ar ? 'rtl' : 'ltr'}>
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-7 text-white shadow-xl dark:border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2 text-indigo-200"><ShieldCheck className="h-5 w-5" />{text('Platform control', 'تحكم المنصة')}</div>
            <h1 className="text-3xl font-black">{text('Integration access by plan', 'صلاحيات التكاملات حسب الخطة')}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">{text('Enable only integrations approved for each commercial plan. Changes are enforced server-side and create system notifications for every active member of affected workspaces.', 'فعّل فقط التكاملات المعتمدة لكل خطة. التغييرات تُفرض من الخادم وتُنشئ إشعارات نظام لكل عضو نشط في الشركات المتأثرة.')}</p>
          </div>
          <div className="hidden rounded-2xl bg-white/10 p-4 sm:block"><BellRing className="h-8 w-8 text-amber-300" /></div>
        </div>
      </section>

      {feedback && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{feedback}</div>}

      <div className="grid gap-6 xl:grid-cols-2">
        {items.map((plan) => (
          <section key={plan.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
              <div><h2 className="text-xl font-black text-slate-950 dark:text-white">{plan.name}</h2><p className="text-xs text-slate-500">{plan.slug} · {plan.isActive ? text('Published', 'منشورة') : text('Archived', 'مؤرشفة')}</p></div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${plan.included ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{plan.included ? text('Integrations included', 'التكاملات مشمولة') : text('Not included', 'غير مشمولة')}</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {managedIntegrationCatalog.map((catalog) => {
                const item = plan.integrations.find((entry) => entry.provider === catalog.provider)!;
                const key = `${plan.id}:${catalog.provider}`;
                const disabled = !plan.included || pending === key;
                return <div key={catalog.provider} className="flex items-center justify-between gap-4 p-5">
                  <div className="flex min-w-0 items-center gap-3"><div className="rounded-xl bg-indigo-50 p-2 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"><PlugZap className="h-5 w-5" /></div><div className="min-w-0"><p className="font-bold text-slate-900 dark:text-white">{ar ? catalog.nameAr : catalog.nameEn}</p><p className="truncate text-xs text-slate-500">{ar ? catalog.descriptionAr : catalog.descriptionEn}</p></div></div>
                  <button type="button" disabled={disabled} onClick={() => toggle(plan.id, catalog.provider, !item.enabled)} className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-bold transition ${item.enabled && plan.included ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'} disabled:cursor-not-allowed disabled:opacity-50`} aria-label={`${catalog.provider} ${item.enabled ? 'enabled' : 'disabled'}`}>
                    {item.enabled && plan.included ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}{item.enabled ? text('Enabled', 'مفعّل') : text('Disabled', 'معطّل')}
                  </button>
                </div>;
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
