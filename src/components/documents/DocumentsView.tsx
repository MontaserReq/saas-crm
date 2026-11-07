'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { FileText, FolderOpen, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { archiveDocumentAction, createDocumentAction } from '@/server/actions/documents';

const EMPTY_CONTENT = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] });

type DocumentListItem = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string };
  _count: { versions: number };
};

export function DocumentsView({ documents, canCreate, canDelete }: { documents: DocumentListItem[]; canCreate: boolean; canDelete: boolean }) {
  const { language } = useI18n();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? documents.filter(document => document.title.toLocaleLowerCase().includes(query)) : documents;
  }, [documents, search]);
  const text = (en: string, ar: string) => language === 'ar' ? ar : en;
  const dateFormatter = new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en', { day: 'numeric', month: 'short', year: 'numeric' });

  const createDocument = () => {
    setError(null);
    startTransition(async () => {
      const result = await createDocumentAction({ title: text('Untitled document', 'مستند جديد'), content: EMPTY_CONTENT });
      if (result.success && result.document) router.push(`/documents/${result.document.id}`);
      else setError(result.error ?? text('Unable to create document.', 'تعذر إنشاء المستند.'));
    });
  };

  const archiveDocument = (id: string) => {
    if (!window.confirm(text('Move this document to archive?', 'هل تريد نقل هذا المستند إلى الأرشيف؟'))) return;
    setError(null);
    startTransition(async () => {
      const result = await archiveDocumentAction(id);
      if (result.success) router.refresh();
      else setError(result.error ?? text('Unable to archive document.', 'تعذر أرشفة المستند.'));
    });
  };

  return (
    <section className="space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex flex-col gap-4 rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-indigo-900 p-6 text-white shadow-xl sm:p-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-brand-100"><Sparkles className="h-3.5 w-3.5" /> {text('Workspace documents', 'مستندات مساحة العمل')}</div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{text('Write and organize CRM knowledge.', 'اكتب ونظّم معرفة الـ CRM.')}</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-brand-100/90">{text('Keep meeting notes, playbooks, account briefs, and internal plans beside the customer records they support.', 'احتفظ بملاحظات الاجتماعات، أدلة العمل، ملخصات الحسابات والخطط الداخلية بجانب سجلات العملاء التي تدعمها.')}</p>
        </div>
        {canCreate && <button type="button" onClick={createDocument} disabled={isPending} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-brand-800 shadow-lg transition hover:bg-brand-50 disabled:cursor-wait disabled:opacity-60"><Plus className="h-4 w-4" /> {text('New document', 'مستند جديد')}</button>}
      </div>

      {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-xl font-black text-slate-900 dark:text-white">{text('Your documents', 'مستنداتك')}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{text(`${documents.length} active document${documents.length === 1 ? '' : 's'}`, `${documents.length} مستند نشط`)}</p></div>
        <label className="relative block sm:w-80"><Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={text('Search documents', 'ابحث في المستندات')} className="h-11 w-full rounded-2xl border border-slate-200 bg-white ps-10 pe-4 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900" /></label>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900"><FolderOpen className="mx-auto h-10 w-10 text-brand-500" /><h3 className="mt-4 text-lg font-black">{search ? text('No matching documents', 'لا توجد مستندات مطابقة') : text('Start your first CRM document', 'ابدأ أول مستند CRM')}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{text('Create a workspace for the knowledge your team uses every day.', 'أنشئ مساحة للمعرفة التي يستخدمها فريقك يوميًا.')}</p></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(document => <article key={document.id} className="group flex min-h-52 flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
            <div><div className="flex items-start justify-between gap-3"><div className="rounded-2xl bg-brand-50 p-3 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300"><FileText className="h-5 w-5" /></div></div><Link href={`/documents/${document.id}`} className="mt-5 block truncate text-lg font-black text-slate-900 hover:text-brand-700 dark:text-white dark:hover:text-brand-300">{document.title}</Link><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{text('Updated', 'آخر تحديث')} {dateFormatter.format(new Date(document.updatedAt))} · {document.createdBy.name}</p></div>
            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800"><span className="text-xs font-semibold text-slate-500">{document._count.versions} {text('saved versions', 'نسخ محفوظة')}</span>{canDelete && <button type="button" onClick={() => archiveDocument(document.id)} disabled={isPending} className="rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" aria-label={text('Archive document', 'أرشفة المستند')}><Trash2 className="h-4 w-4" /></button>}</div>
          </article>)}
        </div>
      )}
    </section>
  );
}
