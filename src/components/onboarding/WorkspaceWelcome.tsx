'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { Check, Plus, Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { industries, moduleLabels, type SetupState } from '@/lib/onboarding/templates';
import { createClientAction, createLeadAction } from '@/server/actions/crm';
import { updateOnboardingChecklistAction } from '@/server/actions/onboarding';

export function WorkspaceWelcome({ state, modules, canCreate, canInvite, canConfigure, canPipeline, canTask }: { state: SetupState; modules: string[]; canCreate: boolean; canInvite: boolean; canConfigure: boolean; canPipeline: boolean; canTask: boolean }) {
  const { language } = useI18n();
  const router = useRouter();
  const ar = language === 'ar';
  const text = (en: string, arabic: string) => ar ? arabic : en;
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checklist, setChecklist] = useState(state);
  const customer = !modules.includes('leads');
  const canAdd = canCreate && (modules.includes('clients') || modules.includes('leads'));
  const items: Array<{ id: 'invite' | 'pipeline' | 'task'; label: string; href: string }> = [
    ...(canInvite && state.answers.teamSize !== '1' ? [{ id: 'invite' as const, label: text('Invite a team member', 'دعوة عضو للفريق'), href: '/admin/users' }] : []),
    ...(canPipeline && modules.includes('pipelines') ? [{ id: 'pipeline' as const, label: text('Customize your pipeline', 'تخصيص مسار المبيعات'), href: '/pipelines' }] : []),
    ...(canTask && modules.includes('tasks') ? [{ id: 'task' as const, label: text('Add a follow-up task', 'إضافة مهمة متابعة'), href: '/tasks' }] : []),
  ];
  async function changeChecklist(input: { dismissed?: boolean; task?: 'invite' | 'pipeline' | 'task'; completed?: boolean }) {
    if (busy) return; setBusy(true); setError('');
    try {
      const result = await updateOnboardingChecklistAction(input);
      if (result.success) setChecklist(result.state);
      else setError(text('Could not save the checklist. Try again.', 'تعذر حفظ القائمة. حاول مجدداً.'));
    } catch { setError(text('Check your connection and try again.', 'تحقق من الاتصال وحاول مجدداً.')); } finally { setBusy(false); }
  }
  async function add(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const result = customer ? await createClientAction({ name }) : await createLeadAction({ name });
      if (!result.success) { setError(text('Unable to add this record. Check the name and try again.', 'تعذر إضافة السجل. تحقق من الاسم وحاول مجدداً.')); return; }
      setName(''); router.refresh();
    } catch { setError(text('Connection interrupted. Check your records before retrying.', 'انقطع الاتصال. تحقق من السجلات قبل إعادة المحاولة.')); } finally { setBusy(false); }
  }
  if (checklist.checklistDismissed) return <section dir={ar ? 'rtl' : 'ltr'} className="mb-6"><button disabled={busy} onClick={() => changeChecklist({ dismissed: false })} className="rounded-xl border border-purple-200 px-4 py-2 text-sm font-semibold dark:border-purple-800">{text('Resume getting started', 'استئناف خطوات البداية')}</button>{error && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>}</section>;
  return <section dir={ar ? 'rtl' : 'ltr'} className="mb-6 space-y-5 rounded-3xl border border-purple-200 bg-white p-5 dark:border-purple-800 dark:bg-slate-900 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">{text('Getting started (optional)', 'خطوات البداية (اختياري)')}</h2><button disabled={busy} onClick={() => changeChecklist({ dismissed: true })} className="rounded-lg px-3 py-2 text-sm text-slate-600 focus-visible:outline-purple-600 dark:text-slate-300">{text('Dismiss checklist', 'إخفاء قائمة البداية')}</button></div>
    <div><p className="mb-3 flex items-center gap-2 text-sm font-bold text-purple-700 dark:text-purple-300"><Sparkles className="h-4 w-4" />{text('Your workspace is ready', 'مساحة عملك جاهزة')}</p><h1 className="text-2xl font-extrabold sm:text-3xl">{text('Welcome to', 'مرحباً بك في')} {state.answers.workspace}</h1><p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">{state.standard ? text('Standard CRM setup', 'إعداد إدارة العملاء العام') : industries[state.answers.industry].title[language]} · {canAdd ? text('Start with one customer. Build from there.', 'ابدأ بعميل واحد وتابع من هناك.') : text('Choose a next step whenever you are ready.', 'اختر خطوتك القادمة عندما تكون جاهزاً.')}</p></div>
    <ul className="flex flex-wrap gap-2">{modules.filter(module => moduleLabels[module]).map(module => <li key={module} className="flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-2 text-sm text-purple-900 dark:bg-purple-950 dark:text-purple-200"><Check className="h-3 w-3" />{moduleLabels[module][language]}</li>)}</ul>
    {canAdd && !state.firstUsefulAt && <form onSubmit={add} className="space-y-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800"><label htmlFor="first-record" className="block font-bold">{customer ? text('Add your first customer', 'أضف أول عميل') : text('Add your first potential customer', 'أضف أول عميل محتمل')}</label><div className="flex flex-col gap-3 sm:flex-row"><input id="first-record" disabled={busy} required minLength={2} maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder={text('Customer or company name', 'اسم العميل أو الشركة')} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 focus:outline-purple-600 dark:border-slate-600 dark:bg-slate-900 dark:text-white" /><button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-700 px-5 py-3 font-bold text-white disabled:opacity-60"><Plus className="h-4 w-4" />{busy ? text('Adding…', 'جارٍ الإضافة…') : text('Add customer', 'إضافة العميل')}</button></div></form>}
    {state.firstUsefulAt && <p role="status" className="text-sm text-purple-700 dark:text-purple-300">{text('Your first customer is saved. Keep working from your menu.', 'تم حفظ أول عميل. تابع عملك من القائمة.')}</p>}
    <ul className="space-y-3">{items.map(item => <li key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><input type="checkbox" disabled={busy} aria-label={text(`Mark complete: ${item.label}`, `تحديد كمكتمل: ${item.label}`)} checked={checklist.checklistCompleted?.includes(item.id) ?? false} onChange={event => changeChecklist({ task: item.id, completed: event.target.checked })} className="h-4 w-4 shrink-0 accent-purple-700" /><Link href={item.href} className="text-sm font-semibold">{item.label}</Link></li>)}</ul>
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    {canConfigure && <Link href="/settings" className="inline-block text-sm font-semibold text-purple-700 dark:text-purple-300">{text('Adjust your workspace', 'تعديل مساحة العمل')}</Link>}
    {canAdd && state.answers.tracking !== 'none' && <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{text('Keep your existing records handy. General customer import is not available yet; you can add customers individually.', 'احتفظ بسجلاتك الحالية. استيراد العملاء العام غير متاح حالياً؛ يمكنك إضافة العملاء واحداً تلو الآخر.')}</p>}
  </section>;
}
