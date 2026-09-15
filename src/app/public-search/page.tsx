'use client';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/context';

export default function PublicSearchPage() {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setLoading(true);
    const r = await fetch(`/api/public-search?q=${encodeURIComponent(q)}`);
    const d = await r.json();
    setData(d.data || []);
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-background dark:bg-slate-950 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">{t('common.publicSearch')}</h1>
        <p className="text-slate-500 mb-6">{t('common.publicSearchDescription')}</p>
        <form onSubmit={run} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} minLength={2} maxLength={80} className="flex-1 rounded-xl border px-4 py-3 bg-white dark:bg-slate-900" placeholder={t('common.schoolOrCity')} />
          <button className="rounded-xl bg-brand-600 text-white px-5">{loading ? t('common.searching') : t('common.search')}</button>
        </form>
        <div className="mt-6 grid gap-3">
          {data.map((x) => (
            <article key={x.id} className="bg-white dark:bg-slate-900 rounded-xl p-4 border">
              <h2 className="font-bold">{x.name}</h2>
              <p className="text-sm text-slate-500">{x.city}{x.area ? ` · ${x.area}` : ''}</p>
              {x.publicDescription && <p className="mt-2 text-sm">{x.publicDescription}</p>}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
