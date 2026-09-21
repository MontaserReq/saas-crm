'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { useRouter } from 'next/navigation';
import {
  createProposalAction,
  updateProposalAction,
  deleteProposalAction,
  generateProposalAction,
} from '@/server/actions/proposals';
import {
  FileText,
  Building2,
  User,
  Mail,
  Phone,
  Trash2,
  Download,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Sparkles,
  Layers,
  Eye,
  Check,
} from 'lucide-react';
import { useDialog } from '@/lib/dialog/context';
import { formatProposalCode } from '@/lib/proposals/proposalUtils';

interface ProposalFormProps {
  proposal?: any;
  templates: Array<{ id: string; name: string; isActive: boolean; originalFileName: string }>;
  schools?: Array<{ id: string; name: string; logoKey?: string | null }>;
  currentUserId: string;
}

export function ProposalForm({
  proposal,
  templates,
  currentUserId,
}: ProposalFormProps) {
  const { t, language } = useI18n();
  const router = useRouter();
  const { confirm } = useDialog();
  const isEditing = !!proposal;

  const [formData, setFormData] = useState({
    title: proposal?.title || '',
    templateId: proposal?.templateId || (templates[0]?.id || ''),
    status: proposal?.status || 'DRAFT',
  });

  // School logo state
  const [logoPreview, setLogoPreview] = useState<string | null>(() => {
    if (proposal?.logoKey) {
      return `/api/proposals/${proposal.id}/logo`;
    }
    return null;
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isNewLogoUploaded, setIsNewLogoUploaded] = useState(false);

  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      setError(language === 'ar' ? 'يرجى اختيار صورة PNG أو JPG أو WebP فقط.' : 'Please upload a PNG, JPG, or WebP image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError(language === 'ar' ? 'حجم الصورة يتجاوز 5 ميغابايت.' : 'Logo image exceeds 5MB size limit.');
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setIsNewLogoUploaded(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError(language === 'ar' ? 'يرجى إدخال عنوان وموضوع العرض' : 'Proposal title / subject is required');
      return;
    }
    if (!formData.templateId) {
      setError(language === 'ar' ? 'يرجى اختيار قالب العرض' : 'Please select a proposal template');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const payload = {
      title: formData.title.trim(),
      clientName: formData.title.trim(),
      templateId: formData.templateId || null,
      status: formData.status as any,
    };

    let targetId = proposal?.id;

    if (isEditing) {
      const res = await updateProposalAction(proposal.id, payload);
      if (!res.success) {
        setLoading(false);
        setError(res.error || 'Failed to update proposal');
        return;
      }
    } else {
      const res = await createProposalAction(payload);
      if (!res.success) {
        setLoading(false);
        setError(res.error || 'Failed to create proposal');
        return;
      }
      targetId = res.proposal?.id;
    }

    // Upload new School Logo if selected
    if (logoFile && targetId) {
      const data = new FormData();
      data.append('logo', logoFile);
      try {
        await fetch(`/api/proposals/${targetId}/logo`, {
          method: 'POST',
          body: data,
        });
      } catch (err) {
        console.warn('Logo upload warning:', err);
      }
    }

    setLoading(false);
    setSuccessMsg(isEditing ? t('proposals.updatedSuccess') : t('proposals.createdSuccess'));

    if (!isEditing && targetId) {
      router.push(`/proposals/${targetId}`);
    } else {
      router.refresh();
    }
  };

  const handleGenerateProposal = async () => {
    if (!proposal?.id) return;
    setGeneratingPdf(true);
    setError(null);

    try {
      const res = await generateProposalAction(proposal.id);
      if (res.success) {
        setSuccessMsg(
          language === 'ar'
            ? 'تم توليد ملف العرض بنجاح ودمج الشعار على القالب!'
            : 'Proposal PDF generated successfully via template overlay!'
        );
        router.refresh();
      } else {
        setError(res.error || 'Failed to generate proposal');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate proposal');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleDelete = async () => {
    if (!proposal) return;
    const approved = await confirm({
      title: t('proposals.deleteProposal'),
      message: t('proposals.deleteConfirm'),
      isDestructive: true,
    });
    if (!approved) return;

    setLoading(true);
    const res = await deleteProposalAction(proposal.id);
    setLoading(false);

    if (res.success) {
      router.push('/proposals');
    } else {
      setError(res.error || 'Failed to delete proposal');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/proposals')}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180 text-slate-700 dark:text-slate-300" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-600" />
                <span>{isEditing ? t('proposals.editProposal') : t('proposals.newProposal')}</span>
              </h1>
              {isEditing && (
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-purple-100 text-brand-700 dark:bg-purple-950/80 dark:text-brand-300 border border-purple-200 dark:border-purple-800">
                  {formatProposalCode(proposal)}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {language === 'ar'
                ? 'إنشاء وتخصيص عرض رسمي مبني على قالب PDF مع دمج شعار المدرسة والشعار الرسمي.'
                : 'Create and generate a proposal overlaying school logos onto reusable PDF templates.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing && (
            <button
              type="button"
              onClick={handleGenerateProposal}
              disabled={generatingPdf || loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-500/20 transition-all disabled:opacity-50"
            >
              {generatingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>{generatingPdf ? t('proposals.generating') : language === 'ar' ? 'توليد العرض (Generate PDF)' : 'Generate Proposal'}</span>
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>{isEditing ? t('common.save') : t('proposals.create')}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Generated Ready Banner (if generated) */}
      {proposal?.generatedPdfKey && (
        <div className="bg-gradient-to-r from-purple-500/10 via-brand-500/10 to-purple-500/10 border border-brand-200 dark:border-brand-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0">
              <Check className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'ملف الـ Proposal جاهز ومُدمج مع القالب!' : 'Proposal PDF is Generated & Ready!'}
                </h3>
                <span className="text-[10px] font-mono font-bold text-brand-600 dark:text-brand-400">
                  {formatProposalCode(proposal)}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {language === 'ar'
                  ? 'تم توليد العرض مع الحفاظ الكامل على تصميم الـ PDF الأصلي وشعار المدرسة.'
                  : 'Generated with school logo and CodeLine branding overlaid onto original template.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/api/proposals/${proposal.id}/preview`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-all shadow-xs"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'معاينة PDF' : 'Preview'}</span>
            </a>

            <a
              href={`/api/proposals/${proposal.id}/download`}
              download
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-all shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('proposals.downloadPdf')}</span>
            </a>
          </div>
        </div>
      )}

      {/* 1. Template & Proposal Title Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Layers className="w-4 h-4 text-brand-600" />
          <span>{language === 'ar' ? 'بيانات العرض والقالب' : 'Proposal Details & Template'}</span>
        </h2>

        <div className="space-y-4">
          {/* Template Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-brand-500" />
              <span>{language === 'ar' ? 'قالب الـ PDF الأساسي' : 'Base PDF Template'} <span className="text-rose-500">*</span></span>
            </label>
            <select
              required
              value={formData.templateId}
              onChange={(e) => setFormData({ ...formData, templateId: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="">-- {language === 'ar' ? 'اختر قالب العرض' : 'Select a Template'} --</option>
              {templates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.name} {!tmpl.isActive ? '(Inactive)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Title & Subject */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {language === 'ar' ? 'عنوان وموضوع العرض' : 'Proposal Title & Subject'} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={
                language === 'ar'
                  ? 'مثال: عرض تقديم نظام الإدارة المدرسية الذكي - مدارس الرواد النموذجية'
                  : 'e.g. Smart School Platform Proposal - Pioneers Academy'
              }
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>
      </div>

      {/* 2. School Logo Management Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <ImageIcon className="w-4 h-4 text-brand-600" />
          <span>{language === 'ar' ? 'شعار المدرسة (School Logo)' : 'School Logo'}</span>
        </h2>

        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {language === 'ar'
            ? 'يتم جلب شعار المدرسة المحفوظ مسبقًا تلقائيًا أو يمكنك رفع / استبدال الشعار. يتم دمج الشعار على الصفحة الأولى من القالب بدقة.'
            : 'School logo is automatically loaded from the school record or can be uploaded directly. Overlay is applied to page 1.'}
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-1">
          {logoPreview ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60">
              <img
                src={logoPreview}
                alt="School Logo"
                className="w-14 h-14 object-contain rounded-lg bg-white p-1 border border-slate-200 dark:border-slate-700"
              />
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {isNewLogoUploaded
                    ? language === 'ar'
                      ? 'تم اختيار شعار جديد (سيتم حفظه وتطبيقه)'
                      : 'New logo selected'
                    : language === 'ar'
                    ? 'الشعار المحفوظ للمدرسة ✓'
                    : 'Saved school logo ✓'}
                </span>
                <label className="cursor-pointer text-[11px] font-semibold text-brand-600 hover:underline inline-flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  <span>{language === 'ar' ? 'استبدال الشعار' : 'Replace Logo'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          ) : (
            <label className="cursor-pointer flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-500 bg-slate-50/50 dark:bg-slate-800/40 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors">
              <Upload className="w-4 h-4 text-brand-500" />
              <span>{language === 'ar' ? 'رفع شعار المدرسة (PNG / JPG / WebP)' : 'Upload School Logo'}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleLogoFileChange}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
        {isEditing ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('proposals.deleteProposal')}</span>
          </button>
        ) : <div />}

        <div className="flex items-center gap-2">
          {isEditing && (
            <button
              type="button"
              onClick={handleGenerateProposal}
              disabled={generatingPdf || loading}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-500/20 transition-all disabled:opacity-50"
            >
              {generatingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>{generatingPdf ? t('proposals.generating') : language === 'ar' ? 'توليد العرض (Generate PDF)' : 'Generate Proposal'}</span>
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>{isEditing ? t('common.save') : t('proposals.create')}</span>
          </button>
        </div>
      </div>
    </form>
  );
}