'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowLeft, ArrowRight, Bold, Check, Clock3, Code2, Download, FileCode2, FileJson, FileText, Heading1, Heading2, Italic, Link2, List, ListOrdered, Lock, Palette, Save, Strikethrough, Underline, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { updateDocumentAction } from '@/server/actions/documents';

type Permission = { userId: string; role: string; user: { id: string; name: string; email: string } };
type DocumentRecord = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  createdBy: { id: string; name: string };
  permissions: Permission[];
  _count: { versions: number };
};

export function DocumentEditor({ document, canEdit }: { document: DocumentRecord; canEdit: boolean }) {
  const { language } = useI18n();
  const text = (en: string, ar: string) => language === 'ar' ? ar : en;
  const initialContent = (() => { try { return JSON.parse(document.content); } catch { return { type: 'doc', content: [{ type: 'paragraph' }] }; } })();
  const [title, setTitle] = useState(document.title);
  const titleRef = useRef(document.title);
  const editorRef = useRef<any>(null);
  const timerRef = useRef<number | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);

  const save = useCallback(async (createVersion: boolean) => {
    const editor = editorRef.current;
    if (!editor || !canEdit) return;
    setSaveState('saving');
    setSaveError(null);
    const result = await updateDocumentAction(document.id, { title: titleRef.current, content: JSON.stringify(editor.getJSON()) }, createVersion);
    if (result.success) setSaveState('saved');
    else { setSaveState('error'); setSaveError(result.error ?? (language === 'ar' ? 'تعذر حفظ المستند.' : 'Unable to save document.')); }
  }, [canEdit, document.id, language]);

  const scheduleSave = useCallback(() => {
    if (!canEdit) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => { void save(false); }, 900);
  }, [canEdit, save]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: canEdit,
    content: initialContent,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false }, underline: {} }),
      Placeholder.configure({ placeholder: text('Start writing your CRM knowledge…', 'ابدأ بكتابة معرفة الـ CRM…') }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyleKit.configure({ backgroundColor: false, lineHeight: false }),
    ],
    onCreate: ({ editor: createdEditor }) => { editorRef.current = createdEditor; },
    onUpdate: () => scheduleSave(),
  });

  useEffect(() => { editorRef.current = editor; return () => { if (timerRef.current) window.clearTimeout(timerRef.current); }; }, [editor]);

  const manualSave = () => { if (timerRef.current) window.clearTimeout(timerRef.current); void save(true); };
  const setLink = () => {
    if (!editor || !canEdit) return;
    setLinkUrl(editor.getAttributes('link').href || '');
    setLinkError(null);
    setLinkDialogOpen(true);
  };
  const applyLink = () => {
    if (!editor || !canEdit) return;
    const url = linkUrl.trim();
    if (!url) { setLinkError(text('Enter a link first.', 'أدخل الرابط أولًا.')); return; }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('unsafe');
      editor.chain().focus().setLink({ href: parsed.toString() }).run();
      setLinkDialogOpen(false);
    } catch { setLinkError(text('Only http:// and https:// links are allowed.', 'يسمح فقط بروابط http:// وhttps://.')); }
  };
  const removeLink = () => {
    if (!editor || !canEdit) return;
    editor.chain().focus().unsetLink().run();
    setLinkDialogOpen(false);
  };
  const applyFontSize = (value: string) => {
    if (!editor || !canEdit) return;
    const chain = editor.chain().focus();
    if (value) chain.setFontSize(value).run();
    else chain.unsetFontSize().run();
  };
  const applyFontFamily = (value: string) => {
    if (!editor || !canEdit) return;
    const chain = editor.chain().focus();
    if (value) chain.setFontFamily(value).run();
    else chain.unsetFontFamily().run();
  };
  const applyColor = (value: string) => { if (editor && canEdit) editor.chain().focus().setColor(value).run(); };
  const downloadDocument = (format: 'pdf' | 'doc' | 'html' | 'txt' | 'json') => {
    if (!editor) return;
    const safeName = (title.trim() || 'crm-document').replace(/[^a-z0-9\u0600-\u06ff_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'crm-document';
    const html = `<!doctype html><html lang="${language === 'ar' ? 'ar' : 'en'}" dir="${language === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Tajawal,Arial,sans-serif;line-height:1.8;padding:32px;color:#172033}h1,h2,h3{line-height:1.3}ul{padding-inline-start:1.5rem}ol{padding-inline-start:1.5rem}a{color:#2563eb;text-decoration:underline}</style></head><body>${editor.getHTML()}</body></html>`;
    if (format === 'pdf') {
      const printWindow = window.open('', '_blank', 'width=900,height=700');
      if (!printWindow) return;
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      window.setTimeout(() => printWindow.print(), 250);
      setDownloadOpen(false);
      return;
    }
    const files = {
      doc: { extension: 'doc', type: 'application/msword', content: html },
      html: { extension: 'html', type: 'text/html;charset=utf-8', content: html },
      txt: { extension: 'txt', type: 'text/plain;charset=utf-8', content: editor.getText({ blockSeparator: '\n\n' }) },
      json: { extension: 'json', type: 'application/json;charset=utf-8', content: JSON.stringify(editor.getJSON(), null, 2) },
    } as const;
    const file = files[format];
    const url = window.URL.createObjectURL(new Blob([file.content], { type: file.type }));
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = `${safeName}.${file.extension}`;
    anchor.click();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    setDownloadOpen(false);
  };
  const BackIcon = language === 'ar' ? ArrowRight : ArrowLeft;
  const Tool = ({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) => <button type="button" disabled={!canEdit} onClick={onClick} title={label} aria-label={label} className={`rounded-lg p-2 transition ${active ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200' : 'text-slate-500 hover:bg-slate-100 hover:text-brand-700 dark:hover:bg-slate-800 dark:hover:text-brand-300'} disabled:cursor-not-allowed disabled:opacity-40`}>{children}</button>;
  const textStyle = editor?.getAttributes('textStyle') as { color?: string; fontFamily?: string; fontSize?: string } | undefined;
  const selectClass = 'h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 outline-none transition hover:border-brand-400 focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';

  return (
    <section className="space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/documents" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-brand-700 dark:text-slate-400 dark:hover:text-brand-300"><BackIcon className="h-4 w-4" /> {text('All documents', 'كل المستندات')}</Link><div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{saveState === 'saving' ? <><Clock3 className="h-4 w-4 animate-pulse" /> {text('Saving…', 'جارٍ الحفظ…')}</> : saveState === 'error' ? <span className="text-red-600">{saveError}</span> : <><Check className="h-4 w-4 text-emerald-600" /> {text('Saved securely', 'محفوظ بأمان')}</>}</div></div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="border-b border-slate-100 p-5 dark:border-slate-800 sm:p-7"><div className="flex items-start gap-3"><Lock className="mt-2 h-4 w-4 shrink-0 text-emerald-600" /><input value={title} onChange={event => { titleRef.current = event.target.value; setTitle(event.target.value); scheduleSave(); }} maxLength={160} disabled={!canEdit} aria-label={text('Document title', 'عنوان المستند')} className="min-w-0 flex-1 bg-transparent text-2xl font-black tracking-tight text-slate-900 outline-none placeholder:text-slate-300 disabled:cursor-default dark:text-white" /></div><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><span>{text('Created by', 'أنشأه')} {document.createdBy.name}</span><span>·</span><span>{document._count.versions} {text('versions', 'نسخ')}</span><span>·</span><span>{canEdit ? text('You can edit', 'يمكنك التعديل') : text('View only', 'عرض فقط')}</span></div></div>

        <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50/70 p-2 dark:border-slate-800 dark:bg-slate-950/30"><Tool label={text('Bold', 'عريض')} active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></Tool><Tool label={text('Italic', 'مائل')} active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></Tool><Tool label={text('Underline', 'تحته خط')} active={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()}><Underline className="h-4 w-4" /></Tool><Tool label={text('Strike', 'يتوسطه خط')} active={editor?.isActive('strike')} onClick={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></Tool><span className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" /><Tool label="Heading 1" active={editor?.isActive('heading', { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></Tool><Tool label="Heading 2" active={editor?.isActive('heading', { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></Tool><Tool label={text('Bulleted list', 'قائمة نقطية')} active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></Tool><Tool label={text('Numbered list', 'قائمة مرقمة')} active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Tool><span className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" /><Tool label={text('Align right', 'محاذاة لليمين')} active={editor?.isActive({ textAlign: 'right' })} onClick={() => editor?.chain().focus().setTextAlign('right').run()}><AlignRight className="h-4 w-4" /></Tool><Tool label={text('Align center', 'توسيط النص')} active={editor?.isActive({ textAlign: 'center' })} onClick={() => editor?.chain().focus().setTextAlign('center').run()}><AlignCenter className="h-4 w-4" /></Tool><Tool label={text('Align left', 'محاذاة لليسار')} active={editor?.isActive({ textAlign: 'left' })} onClick={() => editor?.chain().focus().setTextAlign('left').run()}><AlignLeft className="h-4 w-4" /></Tool><Tool label={text('Justify', 'ضبط النص')} active={editor?.isActive({ textAlign: 'justify' })} onClick={() => editor?.chain().focus().setTextAlign('justify').run()}><AlignJustify className="h-4 w-4" /></Tool><label title={text('Text color', 'لون النص')} className="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-brand-700 dark:hover:bg-slate-800 dark:hover:text-brand-300"><Palette className="h-4 w-4" /><input type="color" value={textStyle?.color || '#0f172a'} onChange={event => applyColor(event.target.value)} disabled={!canEdit} aria-label={text('Text color', 'لون النص')} className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed" /></label><label className="sr-only" htmlFor="document-font-family">{text('Font family', 'نوع الخط')}</label><select id="document-font-family" value={textStyle?.fontFamily || ''} onChange={event => applyFontFamily(event.target.value)} disabled={!canEdit} aria-label={text('Font family', 'نوع الخط')} className={selectClass}><option value="">{text('Font', 'الخط')}</option><option value="Tajawal, Arial, sans-serif">Tajawal</option><option value="Arial, sans-serif">Arial</option><option value="Tahoma, sans-serif">Tahoma</option><option value="Verdana, sans-serif">Verdana</option><option value="Georgia, serif">Georgia</option><option value="Courier New, monospace">Courier New</option></select><label className="sr-only" htmlFor="document-font-size">{text('Font size', 'حجم الخط')}</label><select id="document-font-size" value={textStyle?.fontSize || ''} onChange={event => applyFontSize(event.target.value)} disabled={!canEdit} aria-label={text('Font size', 'حجم الخط')} className={selectClass}><option value="">{text('Size', 'الحجم')}</option><option value="12px">12</option><option value="14px">14</option><option value="16px">16</option><option value="18px">18</option><option value="20px">20</option><option value="24px">24</option><option value="30px">30</option><option value="36px">36</option></select><Tool label={text('Code', 'كود')} active={editor?.isActive('codeBlock')} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}><Code2 className="h-4 w-4" /></Tool><Tool label={text('Link', 'رابط')} active={editor?.isActive('link')} onClick={setLink}><Link2 className="h-4 w-4" /></Tool><span className="ms-auto" /><div className="relative"><button type="button" onClick={() => setDownloadOpen(value => !value)} aria-haspopup="menu" aria-expanded={downloadOpen} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 transition hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:text-slate-200"><Download className="h-3.5 w-3.5" /> {text('Download', 'تنزيل')}</button>{downloadOpen && <div role="menu" className="absolute end-0 top-full z-30 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"><button type="button" role="menuitem" onClick={() => downloadDocument('pdf')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"><FileText className="h-4 w-4 text-rose-500" />PDF / {text('Print', 'حفظ عبر الطباعة')}</button><button type="button" role="menuitem" onClick={() => downloadDocument('doc')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"><FileText className="h-4 w-4 text-blue-500" />Word (.doc)</button><button type="button" role="menuitem" onClick={() => downloadDocument('html')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"><FileCode2 className="h-4 w-4 text-emerald-500" />HTML</button><button type="button" role="menuitem" onClick={() => downloadDocument('txt')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"><FileText className="h-4 w-4 text-slate-500" />TXT</button><button type="button" role="menuitem" onClick={() => downloadDocument('json')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"><FileJson className="h-4 w-4 text-amber-500" />JSON</button></div>}</div><button type="button" onClick={manualSave} disabled={!canEdit || saveState === 'saving'} className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-3 py-2 text-xs font-black text-white transition hover:bg-brand-800 disabled:cursor-wait disabled:opacity-50"><Save className="h-3.5 w-3.5" /> {text('Save version', 'حفظ نسخة')}</button></div>
        <div className="crm-document-editor p-5 sm:p-8"><EditorContent editor={editor} /></div>
      </div>

      {linkDialogOpen && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setLinkDialogOpen(false); }}><div role="dialog" aria-modal="true" aria-labelledby="document-link-dialog-title" className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center justify-between gap-3"><h2 id="document-link-dialog-title" className="text-lg font-black text-slate-900 dark:text-white">{text('Add link', 'إضافة رابط')}</h2><button type="button" onClick={() => setLinkDialogOpen(false)} aria-label={text('Close', 'إغلاق')} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button></div><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{text('Use a safe http:// or https:// address.', 'أدخل رابطًا آمنًا يبدأ بـ http:// أو https://.')}</p><input autoFocus value={linkUrl} onChange={event => { setLinkUrl(event.target.value); setLinkError(null); }} onKeyDown={event => { if (event.key === 'Enter') applyLink(); if (event.key === 'Escape') setLinkDialogOpen(false); }} placeholder="https://example.com" dir="ltr" className="mt-4 h-12 w-full rounded-2xl border border-slate-200 bg-transparent px-4 text-left text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700" />{linkError && <p role="alert" className="mt-2 text-sm font-semibold text-rose-600">{linkError}</p>}<div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setLinkDialogOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">{text('Cancel', 'إلغاء')}</button>{editor?.isActive('link') && <button type="button" onClick={removeLink} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-600 dark:border-rose-900/60">{text('Remove link', 'إزالة الرابط')}</button>}<button type="button" onClick={applyLink} className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-black text-white hover:bg-brand-800">{text('Add link', 'إضافة الرابط')}</button></div></div></div>}
    </section>
  );
}
