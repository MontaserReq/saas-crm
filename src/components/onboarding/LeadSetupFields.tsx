'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';
import { updateLeadAction } from '@/server/actions/crm';

// Small extension of existing lead/custom-value services. Template fields use
// TEXT; other typed custom values remain available through the existing API.
export function LeadSetupFields({ leadId, fields, values }: { leadId: string; fields: Array<{ key: string; label: string; required: boolean }>; values: Record<string, string> }) {
  const { language } = useI18n(); const ar = language === 'ar'; const router = useRouter();
  const [draft, setDraft] = useState(values); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  if (!fields.length) return null;
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const result = await updateLeadAction(leadId, { customFields: Object.fromEntries(fields.map(field => [field.key, draft[field.key] ?? ''])) });
      setMessage(result.success ? ar ? 'تم حفظ التفاصيل' : 'Details saved' : ar ? 'تعذر حفظ التفاصيل. تحقق من الحقول وحاول مجدداً.' : 'Could not save details. Check the fields and try again.');
      if (result.success) router.refresh();
    } catch { setMessage(ar ? 'تحقق من الاتصال وحاول مجدداً.' : 'Check your connection and try again.'); } finally { setBusy(false); }
  }
  return <form onSubmit={save} dir={ar ? 'rtl' : 'ltr'} className="space-y-4 rounded-2xl border border-purple-200 bg-white p-5 dark:border-purple-800 dark:bg-slate-900"><h2 className="font-bold">{ar ? 'تفاصيل خاصة بنشاطك' : 'Details for your business'}</h2><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">{fields.map(field => <label key={field.key} className="block text-sm font-semibold">{field.label}<input required={field.required} maxLength={1000} value={draft[field.key] ?? ''} onChange={event => setDraft({ ...draft, [field.key]: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 focus:outline-purple-600 dark:border-slate-600 dark:bg-slate-800 dark:text-white" /></label>)}</fieldset><button disabled={busy} className="rounded-xl bg-purple-700 px-5 py-3 font-bold text-white">{busy ? ar ? 'جارٍ الحفظ…' : 'Saving…' : ar ? 'حفظ التفاصيل' : 'Save details'}</button>{message && <p role="status" className="text-sm">{message}</p>}</form>;
}
