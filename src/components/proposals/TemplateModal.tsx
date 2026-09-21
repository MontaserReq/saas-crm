'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { Modal } from '@/components/ui/Modal';
import { Upload, FileText, CheckCircle2, Loader2, Settings2, RefreshCw } from 'lucide-react';

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  template?: {
    id: string;
    name: string;
    description?: string | null;
    originalFileName: string;
    fileSize: number;
    isActive: boolean;
    config?: string | null;
  } | null;
}

export function TemplateModal({ isOpen, onClose, onSuccess, template }: TemplateModalProps) {
  const { t, language } = useI18n();
  const isEditing = !!template;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Logo position configurations
  const [schoolLogoPos, setSchoolLogoPos] = useState({
    page: 1,
    x: 430,
    y: 35,
    width: 120,
    height: 60,
  });

  const [codeLineLogoPos, setCodeLineLogoPos] = useState({
    page: 1,
    x: 45,
    y: 35,
    width: 120,
    height: 60,
  });

  useEffect(() => {
    if (template) {
      setName(template.name || '');
      setDescription(template.description || '');
      setIsActive(template.isActive ?? true);
      setFile(null);
      setError(null);

      if (template.config) {
        try {
          const parsed = JSON.parse(template.config);
          if (parsed.schoolLogoPosition) {
            setSchoolLogoPos(parsed.schoolLogoPosition);
          }
          if (parsed.codeLineLogoPosition) {
            setCodeLineLogoPos(parsed.codeLineLogoPosition);
          }
        } catch {}
      }
    } else {
      setName('');
      setDescription('');
      setIsActive(true);
      setFile(null);
      setError(null);
      setSchoolLogoPos({ page: 1, x: 430, y: 35, width: 120, height: 60 });
      setCodeLineLogoPos({ page: 1, x: 45, y: 35, width: 120, height: 60 });
    }
  }, [template, isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
      setError(language === 'ar' ? 'الملف المحدد يجب أن يكون بصيغة PDF فقط.' : 'Only PDF files are allowed.');
      return;
    }

    if (selected.size > 20 * 1024 * 1024) {
      setError(language === 'ar' ? 'حجم الملف يتجاوز الحد المسموح (20MB).' : 'File exceeds 20MB limit.');
      return;
    }

    setFile(selected);
    if (!name.trim()) {
      setName(selected.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '));
    }
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(language === 'ar' ? 'اسم القالب إلزامي' : 'Template name is required');
      return;
    }

    if (!isEditing && !file) {
      setError(language === 'ar' ? 'يرجى اختيار ملف PDF للقالب' : 'Please select a PDF template file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      if (description.trim()) formData.append('description', description.trim());
      formData.append('isActive', isActive ? 'true' : 'false');
      if (file) {
        formData.append('file', file);
      }
      formData.append(
        'config',
        JSON.stringify({
          schoolLogoPosition: schoolLogoPos,
          codeLineLogoPosition: codeLineLogoPos,
        })
      );

      const url = isEditing ? `/api/proposals/templates/${template.id}` : '/api/proposals/templates';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || (isEditing ? 'Failed to update template' : 'Failed to upload template'));
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || (isEditing ? 'Failed to update template' : 'Failed to upload template'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isEditing
          ? language === 'ar'
            ? 'تعديل قالب عرض السعر (Edit Proposal Template)'
            : 'Edit Proposal Template'
          : language === 'ar'
          ? 'رفع قالب عرض سعر جديد (PDF Template)'
          : 'Upload New Proposal Template'
      }
      description={
        isEditing
          ? language === 'ar'
            ? 'تعديل اسم القالب، الوصف، حالة التفعيل، إحداثيات الشعار، أو استبدال ملف الـ PDF الأساسي.'
            : 'Update template name, description, active status, logo overlay coordinates, or replace base PDF.'
          : language === 'ar'
          ? 'ارفع ملف PDF جاهز ليتم استخدامه كقالب متكرر وإضافة شعار المدرسة عليه تلقائيًا.'
          : 'Upload a reusable PDF proposal base template to overlay school and CodeLine logos dynamically.'
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Template Name & Status */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {language === 'ar' ? 'اسم القالب' : 'Template Name'} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                language === 'ar'
                  ? 'مثال: قالب عروض المدارس - النظام الذكي'
                  : 'e.g. Schools - Smart Platform Proposal Template'
              }
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          {isEditing && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="template-active-check"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-700"
              />
              <label htmlFor="template-active-check" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                {language === 'ar' ? 'القالب نشط ومتاح للاختيار عند إنشاء عروض جديدة' : 'Template is active and selectable'}
              </label>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {language === 'ar' ? 'الوصف (اختياري)' : 'Description (Optional)'}
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              language === 'ar'
                ? 'وصف لنطاق استخدام هذا القالب والخدمات المشمولة فيه...'
                : 'Brief notes on when to use this template...'
            }
            className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* PDF File Upload / Replacement */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {language === 'ar' ? 'ملف الـ PDF الأصلي' : 'PDF Template File'}{' '}
            {!isEditing && <span className="text-rose-500">*</span>}
          </label>

          <div className="p-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-brand-500 bg-slate-50/50 dark:bg-slate-800/40 text-center transition-colors">
            {file ? (
              <div className="flex items-center justify-center gap-2 text-xs text-brand-700 dark:text-brand-300 font-bold">
                <FileText className="w-5 h-5 text-brand-600" />
                <span>{file.name}</span>
                <span className="text-slate-400 font-normal">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="ms-2 text-rose-500 hover:underline text-[11px]"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            ) : isEditing ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-xs text-slate-700 dark:text-slate-300 font-semibold">
                  <FileText className="w-4 h-4 text-brand-600" />
                  <span>{template.originalFileName}</span>
                  <span className="text-slate-400 font-normal">
                    ({(template.fileSize / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                </div>
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand-500 text-xs font-bold text-brand-600 dark:text-brand-400 transition-colors shadow-sm">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'استبدال ملف الـ PDF' : 'Replace PDF File'}</span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <p className="text-[10px] text-slate-400">
                  {language === 'ar' ? 'اترك الملف كما هو إذا كنت لا ترغب بتغييره.' : 'Leave as-is to keep current PDF file.'}
                </p>
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-brand-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {language === 'ar' ? 'انقر لاختيار ملف PDF أو اسحبه هنا' : 'Click to select PDF or drag and drop'}
                </span>
                <span className="text-[10px] text-slate-400">PDF up to 20MB</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Logo Placement Configuration */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white mb-2">
            <Settings2 className="w-4 h-4 text-brand-600" />
            <span>{language === 'ar' ? 'موضع شعار المدرسة في الصفحة الأولى' : 'School Logo Box (Page 1)'}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500">X (pt)</label>
              <input
                type="number"
                value={schoolLogoPos.x}
                onChange={(e) => setSchoolLogoPos({ ...schoolLogoPos, x: Number(e.target.value) })}
                className="w-full p-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500">Y (pt)</label>
              <input
                type="number"
                value={schoolLogoPos.y}
                onChange={(e) => setSchoolLogoPos({ ...schoolLogoPos, y: Number(e.target.value) })}
                className="w-full p-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500">{language === 'ar' ? 'العرض' : 'Width'}</label>
              <input
                type="number"
                value={schoolLogoPos.width}
                onChange={(e) => setSchoolLogoPos({ ...schoolLogoPos, width: Number(e.target.value) })}
                className="w-full p-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500">{language === 'ar' ? 'الارتفاع' : 'Height'}</label>
              <input
                type="number"
                value={schoolLogoPos.height}
                onChange={(e) => setSchoolLogoPos({ ...schoolLogoPos, height: Number(e.target.value) })}
                className="w-full p-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center"
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {language === 'ar'
              ? 'يتم وضع الشعار بدقة مع الحفاظ التلقائي على نسبة الأبعاد والتوسيط داخل هذه المنطقة.'
              : 'Logos are automatically centered and proportional inside this bounding box.'}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-500/20 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>{loading ? t('common.loading') : isEditing ? (language === 'ar' ? 'حفظ التعديلات' : 'Save Changes') : (language === 'ar' ? 'حفظ القالب' : 'Save Template')}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}