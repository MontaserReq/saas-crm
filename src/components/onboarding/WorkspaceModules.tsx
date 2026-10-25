'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';
import { moduleLabels } from '@/lib/onboarding/templates';
import { updateOrganizationListsAction } from '@/server/actions/configuration';

export function WorkspaceModules({ initialModules }: { initialModules: string[] }) {
  const { language } = useI18n(); const ar = language === 'ar'; const router = useRouter();
  const [modules, setModules] = useState(initialModules); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    try { const result = await updateOrganizationListsAction({ enabledModules: modules }); setMessage(result.success ? ar ? 'تم حفظ القائمة' : 'Menu saved' : ar ? 'تعذر الحفظ. حاول مجدداً.' : 'Could not save. Try again.'); if (result.success) router.refresh(); } catch { setMessage(ar ? 'تحقق من الاتصال وحاول مجدداً.' : 'Check your connection and try again.'); } finally { setBusy(false); }
  }
  return <form onSubmit={save} className="space-y-4 rounded-3xl border bg-white p-6 dark:bg-slate-900"><h2 className="font-bold">{ar ? 'قائمة مساحة العمل' : 'Workspace menu'}</h2><p className="text-sm text-slate-600 dark:text-slate-300">{ar ? 'اختر ما يظهر في قائمتك. إخفاء القسم يحافظ على سجلاته ولا يغيّر صلاحيات الفريق.' : 'Choose what appears in your menu. Hiding a section keeps its records and your team’s permissions.'}</p><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(moduleLabels).map(([id, label]) => <label key={id} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={modules.includes(id)} disabled={id === 'dashboard'} onChange={e => setModules(e.target.checked ? [...modules, id] : modules.filter(item => item !== id))} className="h-4 w-4 accent-purple-700" />{label[language]}</label>)}</fieldset><button disabled={busy} className="rounded-xl bg-purple-700 px-4 py-3 font-bold text-white">{busy ? ar ? 'جارٍ الحفظ…' : 'Saving…' : ar ? 'حفظ القائمة' : 'Save menu'}</button>{message && <p role="status" className="text-sm">{message}</p>}</form>;
}
