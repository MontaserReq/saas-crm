'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Clock3, Download, ExternalLink, FileDown, Link2, Loader2, Palette, Plus, RefreshCw, ShieldCheck, Unplug, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';

type ExportFormat = 'pdf' | 'jpg' | 'png' | 'pptx' | 'gif' | 'mp4' | 'html_bundle' | 'html_standalone' | 'csv';
type Design = {
  id: string;
  title?: string;
  thumbnail?: { url?: string };
  urls?: { edit_url?: string; view_url?: string };
  updated_at?: number;
};
type Props = {
  connection: { connected: boolean; accountEmail: string | null; tokenExpiresAt: string | null };
  canManage: boolean;
  available: boolean;
  configured: boolean;
  redirectUri: string;
  startUrl: string;
};

const allFormats: ExportFormat[] = ['pdf', 'png', 'jpg', 'gif', 'pptx', 'mp4', 'csv', 'html_bundle', 'html_standalone'];
const formatLabel: Record<ExportFormat, string> = { pdf: 'PDF', png: 'PNG', jpg: 'JPG', gif: 'GIF', pptx: 'PPTX', mp4: 'MP4', csv: 'CSV', html_bundle: 'HTML ZIP', html_standalone: 'HTML' };

export function CanvaIntegrationSettings({ connection: initialConnection, canManage, available, configured, redirectUri, startUrl }: Props) {
  const { language } = useI18n();
  const searchParams = useSearchParams();
  const ar = language === 'ar';
  const text = (arabic: string, english: string) => ar ? arabic : english;
  const [connection, setConnection] = useState(initialConnection);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [query, setQuery] = useState('');
  const [ownership, setOwnership] = useState<'any' | 'owned' | 'shared'>('any');
  const [continuation, setContinuation] = useState<string | null>(null);
  const [title, setTitle] = useState('New CRM design');
  const [designType, setDesignType] = useState<'doc' | 'email' | 'presentation' | 'whiteboard'>('presentation');
  const [selectedFormat, setSelectedFormat] = useState<Record<string, ExportFormat>>({});
  const [supportedFormats, setSupportedFormats] = useState<Record<string, ExportFormat[]>>({});
  const [loadingFormats, setLoadingFormats] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [loadingDesigns, setLoadingDesigns] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const designTypeOptions: Array<{ value: typeof designType; label: string; description: string }> = [
    { value: 'presentation', label: text('عرض تقديمي', 'Presentation'), description: text('شرائح للعرض والاجتماعات', 'Slides for presenting and meetings') },
    { value: 'doc', label: text('مستند', 'Document'), description: text('صفحة كتابة وتحرير', 'A writing and editing document') },
    { value: 'email', label: text('بريد إلكتروني', 'Email'), description: text('تصميم لحملة بريدية', 'An email campaign design') },
    { value: 'whiteboard', label: text('لوحة بيضاء', 'Whiteboard'), description: text('مساحة مفتوحة للأفكار', 'An open space for ideas') },
  ];
  const authorizationNotice = (() => {
    const status = searchParams.get('canva');
    const reason = searchParams.get('reason');
    if (status === 'connected') return text('تم ربط حساب Canva الخاص بك بنجاح.', 'Your Canva account was connected successfully.');
    if (status === 'cancelled') return text('تم إلغاء تفويض Canva ولم يتم حفظ أي بيانات.', 'Canva authorization was cancelled. No credentials were saved.');
    if (status === 'forbidden') return text('ليس لديك صلاحية لإدارة اتصال Canva.', 'You are not allowed to manage this Canva connection.');
    if (status === 'failed') return reason === 'invalid-state' ? text('انتهت جلسة ربط Canva. ابدأ الربط من جديد.', 'The Canva connection session expired. Start again.') : text('تعذر إكمال ربط Canva ولم يتم حفظ بيانات جديدة.', 'Canva connection could not be completed. No new credentials were saved.');
    return '';
  })();

  async function loadDesigns(options: { append?: boolean; ownershipOverride?: 'any' | 'owned' | 'shared' } = {}) {
    if (!connection.connected) return;
    setLoadingDesigns(true);
    setMessage(null);
    try {
      const activeOwnership = options.ownershipOverride || ownership;
      const params = new URLSearchParams({ ownership: activeOwnership });
      if (query.trim()) params.set('query', query.trim());
      if (options.append && continuation) params.set('continuation', continuation);
      const response = await fetch(`/api/integrations/canva/designs?${params.toString()}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || text('تعذر تحميل تصاميم Canva.', 'Unable to load Canva designs.'));
      setDesigns((current) => options.append ? [...current, ...(result.items || [])] : (result.items || []));
      setContinuation(result.continuation || null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text('تعذر تحميل التصاميم.', 'Unable to load designs.'));
    } finally { setLoadingDesigns(false); }
  }

  useEffect(() => { void loadDesigns(); }, [connection.connected]);

  async function createDesign() {
    if (!title.trim() || busy) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch('/api/integrations/canva/designs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, designType }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || text('تعذر إنشاء التصميم.', 'Unable to create design.'));
      if (result.design?.urls?.edit_url) window.open(result.design.urls.edit_url, '_blank', 'noopener,noreferrer');
      setMessage(text('تم إنشاء التصميم وفتح Canva.', 'Design created and Canva opened.'));
      await loadDesigns();
    } catch (error) { setMessage(error instanceof Error ? error.message : text('تعذر إنشاء التصميم.', 'Unable to create design.')); }
    finally { setBusy(false); }
  }

  async function loadFormats(designId: string) {
    if (supportedFormats[designId] || loadingFormats[designId]) return;
    setLoadingFormats((current) => ({ ...current, [designId]: true }));
    try {
      const response = await fetch(`/api/integrations/canva/formats?designId=${encodeURIComponent(designId)}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || text('تعذر قراءة صيغ التصميم.', 'Unable to read this design’s export formats.'));
      const formats = allFormats.filter((format) => Object.prototype.hasOwnProperty.call(result.formats || {}, format));
      if (formats.length) {
        setSupportedFormats((current) => ({ ...current, [designId]: formats }));
        setSelectedFormat((current) => ({ ...current, [designId]: formats.includes(current[designId]) ? current[designId] : formats[0] }));
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : text('تعذر قراءة الصيغ.', 'Unable to read export formats.')); }
    finally { setLoadingFormats((current) => ({ ...current, [designId]: false })); }
  }

  async function disconnect() {
    setShowDisconnectDialog(false); setBusy(true); setMessage(null);
    try {
      const response = await fetch('/api/integrations/canva', { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || text('تعذر فصل Canva.', 'Unable to disconnect Canva.'));
      setConnection({ connected: false, accountEmail: null, tokenExpiresAt: null }); setDesigns([]); setContinuation(null);
      setMessage(text('تم فصل Canva وإلغاء صلاحية الاتصال.', 'Canva was disconnected and its authorization was revoked.'));
    } catch (error) { setMessage(error instanceof Error ? error.message : text('تعذر فصل Canva.', 'Unable to disconnect Canva.')); }
    finally { setBusy(false); }
  }

  const expiry = connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt) : null;
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900" dir={ar ? 'rtl' : 'ltr'}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7d2ae8]/10 text-[#7d2ae8]" aria-hidden="true"><Palette className="h-5 w-5" /></span><div><h2 className="font-bold">Canva</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">{text('صمّم من Canva واربط التصاميم والملفات مباشرة بالشركة.', 'Design in Canva and bring designs and exports into the company workspace.')}</p></div></div>
      {!connection.connected ? configured && canManage ? <Link href={startUrl} className="inline-flex items-center gap-2 rounded-xl bg-[#7d2ae8] px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#7d2ae8] focus:ring-offset-2"><Link2 className="h-4 w-4" />{text('ربط Canva', 'Connect Canva')}</Link> : <button type="button" disabled className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-[#7d2ae8] px-4 py-2.5 text-sm font-bold text-white opacity-50"><Link2 className="h-4 w-4" />{text('ربط Canva', 'Connect Canva')}</button> : <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" />{text('متصل', 'Connected')}{connection.accountEmail ? ` · ${connection.accountEmail}` : ''}</span><button type="button" onClick={() => setShowDisconnectDialog(true)} disabled={busy || !canManage} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold text-rose-600 disabled:opacity-50"><Unplug className="h-3.5 w-3.5" />{text('فصل', 'Disconnect')}</button></div>}
    </div>
    {!configured && canManage && <div role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">{text('لم يتم إعداد Canva بعد. أضف CANVA_CLIENT_ID وCANVA_CLIENT_SECRET في ملف البيئة، وسجّل رابط العودة التالي في Canva Developer Portal:', 'Canva is not configured yet. Add CANVA_CLIENT_ID and CANVA_CLIENT_SECRET to the environment, then register this callback URL in Canva Developer Portal:')} <code dir="ltr" className="mx-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs dark:bg-amber-900/50">{redirectUri}</code></div>}
    {!available && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{text('تكامل Canva متاح فقط للخطط التي تشمل التكاملات. اطلب تفعيل الميزة من مسؤول المنصة.', 'Canva integration is available only on plans that include integrations. Ask the platform administrator to enable it.')}</p>}
    {authorizationNotice && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300">{authorizationNotice}</p>}
    {connection.connected && expiry && <p className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" />{text('صلاحية الاتصال حتى', 'Connection valid until')} {expiry.toLocaleString(language === 'ar' ? 'ar-JO' : 'en-US')}</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-violet-50 p-3 text-sm text-violet-800 dark:bg-violet-950/30 dark:text-violet-200">{message}</p>}
    {connection.connected && <>
      <div className="mt-5 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1"><label className="sr-only" htmlFor="canva-design-title">{text('اسم التصميم', 'Design title')}</label><input id="canva-design-title" value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm" placeholder={text('اسم التصميم', 'Design title')} /></div>
          <button type="button" onClick={() => void createDesign()} disabled={busy || !title.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#7d2ae8] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{text('إنشاء تصميم', 'Create design')}</button>
        </div>
        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-bold">{text('اختر نوع التصميم قبل الإنشاء', 'Choose the design type before creating')}</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {designTypeOptions.map((option) => <button key={option.value} type="button" aria-pressed={designType === option.value} onClick={() => setDesignType(option.value)} className={`rounded-xl border p-3 text-start transition focus:outline-none focus:ring-2 focus:ring-[#7d2ae8] ${designType === option.value ? 'border-[#7d2ae8] bg-[#7d2ae8]/10 ring-1 ring-[#7d2ae8]' : 'border-slate-200 hover:border-[#7d2ae8]/60 dark:border-slate-700'}`}><span className="block text-sm font-bold">{option.label}</span><span className="mt-1 block text-xs text-slate-500">{option.description}</span></button>)}
          </div>
          <p className="mt-2 text-xs text-slate-500">{text('المحدد حاليًا: ', 'Currently selected: ')}{designTypeOptions.find((option) => option.value === designType)?.label}</p>
        </fieldset>
      </div>
      <div className="mt-5 flex flex-wrap gap-2"><label className="sr-only" htmlFor="canva-search">{text('البحث في التصاميم', 'Search designs')}</label><input id="canva-search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void loadDesigns(); }} className="min-w-[220px] flex-1 rounded-xl border bg-transparent px-3 py-2 text-sm" placeholder={text('ابحث في تصاميم Canva', 'Search Canva designs')} /><select aria-label={text('ملكية التصميم', 'Design ownership')} value={ownership} onChange={(event) => { const nextOwnership = event.target.value as typeof ownership; setOwnership(nextOwnership); void loadDesigns({ ownershipOverride: nextOwnership }); }} className="rounded-xl border bg-transparent px-3 py-2 text-sm"><option value="any">{text('كل التصاميم', 'All designs')}</option><option value="owned">{text('تصاميمي', 'Owned by me')}</option><option value="shared">{text('المشاركة معي', 'Shared with me')}</option></select><button type="button" onClick={() => void loadDesigns()} disabled={loadingDesigns} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-50">{loadingDesigns ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{text('تحديث', 'Refresh')}</button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{designs.map((design) => { const formats = supportedFormats[design.id] || allFormats; const format = selectedFormat[design.id] || formats[0]; const filename = encodeURIComponent(design.title || 'canva-design'); return <article key={design.id} className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700"><div className="aspect-video bg-slate-100 dark:bg-slate-800">{design.thumbnail?.url ? <img src={design.thumbnail.url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-400"><Palette className="h-8 w-8" /></div>}</div><div className="p-3"><h3 className="truncate text-sm font-bold" title={design.title}>{design.title || text('بدون اسم', 'Untitled design')}</h3><div className="mt-3 flex flex-wrap gap-2"><a href={design.urls?.edit_url || '#'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-[#7d2ae8] px-2.5 py-1.5 text-xs font-bold text-white"><ExternalLink className="h-3.5 w-3.5" />{text('فتح في Canva', 'Open in Canva')}</a><label className="sr-only" htmlFor={`format-${design.id}`}>{text('صيغة التنزيل', 'Download format')}</label><select id={`format-${design.id}`} value={format} onFocus={() => void loadFormats(design.id)} onChange={(event) => setSelectedFormat((current) => ({ ...current, [design.id]: event.target.value as ExportFormat }))} className="min-w-[92px] rounded-lg border bg-transparent px-2 py-1.5 text-xs font-bold" disabled={loadingFormats[design.id]}>{formats.map((item) => <option key={item} value={item}>{formatLabel[item]}</option>)}</select><a href={`/api/integrations/canva/exports?designId=${encodeURIComponent(design.id)}&format=${format}&filename=${filename}`} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold"><Download className="h-3.5 w-3.5" />{text('تنزيل', 'Download')}</a></div></div></article>; })}</div>
      {!loadingDesigns && designs.length === 0 && <p className="mt-5 rounded-xl border border-dashed p-5 text-center text-sm text-slate-500">{text('لا توجد تصاميم ظاهرة لهذا الحساب.', 'No Canva designs found for this account.')}</p>}
      {continuation && <button type="button" onClick={() => void loadDesigns({ append: true })} disabled={loadingDesigns} className="mx-auto mt-5 flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50">{loadingDesigns ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}{text('تحميل المزيد', 'Load more')}</button>}
    </>}
    {showDisconnectDialog && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowDisconnectDialog(false); }}><div role="dialog" aria-modal="true" aria-labelledby="canva-disconnect-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><div><h3 id="canva-disconnect-title" className="font-bold">{text('فصل Canva؟', 'Disconnect Canva?')}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text('سيتم حذف الاتصال من هذه الشركة وإلغاء صلاحية Canva. لن يتم حذف تصاميمك من Canva.', 'This removes the connection from this company and revokes Canva authorization. Your Canva designs will not be deleted.')}</p></div><button type="button" onClick={() => setShowDisconnectDialog(false)} aria-label={text('إغلاق', 'Close')} className="rounded-lg p-1 text-slate-500"><X className="h-5 w-5" /></button></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowDisconnectDialog(false)} className="rounded-xl border px-4 py-2 text-sm font-bold">{text('إلغاء', 'Cancel')}</button><button type="button" onClick={() => void disconnect()} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white">{text('فصل الاتصال', 'Disconnect')}</button></div></div></div>}
  </section>;
}
