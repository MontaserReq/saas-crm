'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, Globe2, Loader2, Search, Sparkles, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createLeadDiscoveryJobAction, getLeadDiscoveryJobAction, importLeadDiscoveryResultsAction } from '@/server/actions/lead-discovery';

type Job = { id: string; prompt: string; status: string; stage: string; requestedCount: number; createdAt: string; _count?: { results: number } };
type Result = { id: string; companyName: string; website: string | null; industry: string | null; country: string | null; city: string | null; phone: string | null; email: string | null; leadRelevanceScore: number; dataCompleteness: number; qualificationReason: string | null; verificationStatus: string; importedLeadId: string | null; sources: Array<{ id: string; url: string; snippet: string | null }> };

const stages = ['UNDERSTANDING', 'GENERATING_QUERIES', 'SEARCHING_WEB', 'ENRICHING_WEBSITES', 'EXTRACTING', 'VALIDATING', 'DEDUPLICATING', 'SCORING', 'READY'];

export function LeadDiscoveryView({ initialJobs, canImport, language }: { initialJobs: Job[]; canImport: boolean; language: 'ar' | 'en' }) {
  const ar = language === 'ar';
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJobs[0]?.id || null);
  const [job, setJob] = useState<any>(null);
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(20);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!selectedJobId) return;
    let cancelled = false;
    const load = async () => { const result = await getLeadDiscoveryJobAction(selectedJobId); if (!cancelled && result.success) setJob(result.job); };
    void load();
    const timer = setInterval(() => void load(), 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [selectedJobId]);

  const results: Result[] = useMemo(() => job?.results || [], [job?.results]);
  const running = job && !['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'].includes(job.status);
  const selectedResults = useMemo(() => results.filter((item) => selected.includes(item.id)), [results, selected]);

  async function start(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMessage(null);
    const result = await createLeadDiscoveryJobAction({ prompt, requestedCount: count });
    if (result.success) { setPrompt(''); setSelectedJobId(result.job.id); setJobs((current) => [{ id: result.job.id, prompt, status: result.job.status, stage: result.job.stage, requestedCount: count, createdAt: new Date().toISOString(), _count: { results: 0 } }, ...current]); setMessage(ar ? 'بدأ البحث. سيتم تحديث النتائج تلقائياً.' : 'Discovery started. Results will update automatically.'); }
    else setMessage(result.error);
    setLoading(false); router.refresh();
  }

  async function importSelected() {
    if (!selectedJobId || !selectedResults.length) return;
    setLoading(true); const result = await importLeadDiscoveryResultsAction(selectedJobId, selected); setMessage(result.success ? (ar ? `تمت معالجة ${result.imported.length} نتيجة.` : `Processed ${result.imported.length} results.`) : result.error); setLoading(false); if (result.success) { setSelected([]); const next = await getLeadDiscoveryJobAction(selectedJobId); if (next.success) setJob(next.job); router.refresh(); }
  }

  return <div className="space-y-6" dir={ar ? 'rtl' : 'ltr'}>
    <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 p-6 text-white shadow-xl sm:p-9"><div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-200"><Sparkles className="h-6 w-6" /></span><div><p className="text-xs font-bold uppercase tracking-[.25em] text-cyan-300">{ar ? 'اكتشاف ذكي' : 'SMART DISCOVERY'}</p><h1 className="mt-2 text-3xl font-black">{ar ? 'اكتشف عملاء محتملين حقيقيين' : 'Discover real potential customers'}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{ar ? 'اكتب وصفاً طبيعياً للجمهور المستهدف. سنبحث في الويب، نتحقق من المصادر، ونترك قرار الاستيراد لك.' : 'Describe your target audience in natural language. We search the web, preserve evidence, and leave the import decision to you.'}</p></div></div></div>
    {message && <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200">{message}</div>}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><form onSubmit={start} className="space-y-4"><label className="block text-sm font-bold">{ar ? 'ما الشركات التي تريد إيجادها؟' : 'What businesses do you want to find?'}<textarea required minLength={5} maxLength={4000} value={prompt} onChange={(e) => setPrompt(e.target.value)} className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder={ar ? 'مثال: ابحث عن 30 وكالة تسويق رقمي صغيرة ومتوسطة في الأردن، ويفضل عمّان، لديها بيانات اتصال عامة.' : 'Example: Find 30 small and medium digital marketing agencies in Jordan, preferably in Amman, with public contact details.'} /></label><div className="flex flex-wrap items-end gap-4"><label className="text-sm font-bold">{ar ? 'عدد النتائج' : 'Result count'}<input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} className="mt-2 block w-32 rounded-xl border border-slate-300 p-3 dark:border-slate-700 dark:bg-slate-950" /></label><button disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><Search className="h-4 w-4" />{loading ? (ar ? 'جارٍ التشغيل…' : 'Starting…') : (ar ? 'ابدأ الاكتشاف' : 'Start discovery')}</button></div></form></section>
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]"><aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="px-3 py-2 text-sm font-bold">{ar ? 'عمليات البحث' : 'Searches'}</h2>{jobs.length === 0 && <p className="px-3 py-8 text-center text-xs text-slate-500">{ar ? 'لا توجد عمليات بعد.' : 'No searches yet.'}</p>}{jobs.map((item) => <button key={item.id} onClick={() => setSelectedJobId(item.id)} className={`mb-1 w-full rounded-xl p-3 text-start ${item.id === selectedJobId ? 'bg-violet-50 text-violet-900 dark:bg-violet-950/40 dark:text-violet-100' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}><p className="line-clamp-2 text-xs font-bold">{item.prompt}</p><p className="mt-1 text-[11px] text-slate-500">{item.status} · {item._count?.results || 0} results</p></button>)}</aside><main className="min-w-0 space-y-4">{!job ? <div className="rounded-2xl border border-dashed p-12 text-center text-slate-500">{ar ? 'اختر عملية بحث أو ابدأ واحدة جديدة.' : 'Choose a search or start a new one.'}</div> : <><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-violet-600">{job.status}</p><h2 className="mt-1 font-bold">{job.prompt}</h2></div>{running && <Loader2 className="h-5 w-5 animate-spin text-violet-600" />}</div><div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-9">{stages.map((stage, index) => <div key={stage} className={`rounded-lg p-2 text-center text-[10px] font-bold ${stages.indexOf(job.stage) >= index ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}><span>{index + 1}</span><p className="mt-1 hidden sm:block">{stage.replaceAll('_', ' ')}</p></div>)}</div></section><section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800"><div><h2 className="font-bold">{ar ? 'النتائج المدعومة بالمصادر' : 'Evidence-backed results'}</h2><p className="text-xs text-slate-500">{results.length} {ar ? 'نتيجة' : 'results'} · {ar ? 'راجعها قبل الاستيراد' : 'review before importing'}</p></div>{canImport && <button disabled={loading || !selected.length} onClick={importSelected} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"><Upload className="h-4 w-4" />{ar ? 'استيراد المحدد' : 'Import selected'}</button>}</div><div className="divide-y dark:divide-slate-800">{results.map((item) => <article key={item.id} className="p-4"><div className="flex items-start gap-3"><input type="checkbox" disabled={Boolean(item.importedLeadId)} checked={selected.includes(item.id)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} className="mt-1" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{item.companyName}</h3><span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-bold text-violet-700">{item.leadRelevanceScore}/100</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{item.verificationStatus}</span>{item.importedLeadId && <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">IMPORTED</span>}</div><div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">{item.website && <a href={item.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-violet-600"><Globe2 className="h-3.5 w-3.5" />{item.website}</a>}{(item.city || item.country) && <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{[item.city, item.country].filter(Boolean).join(', ')}</span>}{item.email && <span>{item.email}</span>}{item.phone && <span>{item.phone}</span>}</div><p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{item.qualificationReason}</p><div className="mt-2 flex flex-wrap gap-2">{item.sources.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className="max-w-full truncate text-[11px] text-cyan-700 underline">{source.url}</a>)}</div></div></div></article>)}{!results.length && <div className="p-12 text-center text-sm text-slate-500">{running ? (ar ? 'يتم جمع النتائج والتحقق منها…' : 'Collecting and validating results…') : (ar ? 'لم يتم العثور على نتائج.' : 'No results found.')}</div>}</div></section></>}</main></div>
  </div>;
}
