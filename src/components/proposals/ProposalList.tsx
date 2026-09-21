'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n/context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Plus,
  Search,
  Building2,
  Calendar,
  User,
  Download,
  Trash2,
  Edit,
  Eye,
  CheckCircle2,
  Clock,
  Send,
  Upload,
  Layers,
  FileCheck,
  Check,
} from 'lucide-react';
import { deleteProposalAction } from '@/server/actions/proposals';
import {
  deleteProposalTemplateAction,
  updateProposalTemplateAction,
} from '@/server/actions/proposalTemplates';
import { TemplateModal } from './TemplateModal';
import { useDialog } from '@/lib/dialog/context';
import { formatProposalCode } from '@/lib/proposals/proposalUtils';

interface ProposalListProps {
  proposals: any[];
  templates: any[];
  schools: Array<{ id: string; name: string }>;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canGenerate: boolean;
  canManageTemplates: boolean;
}

export function ProposalList({
  proposals: initialProposals,
  templates: initialTemplates,
  schools,
  canCreate,
  canEdit,
  canDelete,
  canGenerate,
  canManageTemplates,
}: ProposalListProps) {
  const { t, language } = useI18n();
  const router = useRouter();
  const { confirm } = useDialog();

  const [activeTab, setActiveTab] = useState<'proposals' | 'templates'>('proposals');
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedTemplate, setSelectedTemplate] = useState('ALL');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);

  // Proposals filtering
  const filteredProposals = initialProposals.filter((p) => {
    if (selectedStatus !== 'ALL' && p.status !== selectedStatus) return false;
    if (selectedTemplate !== 'ALL' && p.templateId !== selectedTemplate) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const code = formatProposalCode(p).toLowerCase();
      const matchCode = code.includes(q);
      const matchTitle = p.title?.toLowerCase().includes(q);
      const matchTemplate = p.template?.name?.toLowerCase().includes(q);
      if (!matchCode && !matchTitle && !matchTemplate) return false;
    }
    return true;
  });

  // Templates filtering
  const filteredTemplates = initialTemplates.filter((tmpl) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        tmpl.name?.toLowerCase().includes(q) ||
        tmpl.description?.toLowerCase().includes(q) ||
        tmpl.originalFileName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'GENERATED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-50 dark:bg-purple-950/60 text-brand-700 dark:text-brand-300 border border-purple-200 dark:border-purple-800">
            <CheckCircle2 className="w-3 h-3" />
            <span>{t('proposals.statusGenerated')}</span>
          </span>
        );
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <Send className="w-3 h-3" />
            <span>{t('proposals.statusSent')}</span>
          </span>
        );
      case 'DRAFT':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3" />
            <span>{t('proposals.statusDraft')}</span>
          </span>
        );
    }
  };

  const handleDeleteProposal = async (proposal: any) => {
    const approved = await confirm({
      title: t('proposals.deleteProposal'),
      message: t('proposals.deleteConfirm'),
      isDestructive: true,
    });
    if (!approved) return;

    const res = await deleteProposalAction(proposal.id);
    if (res.success) {
      router.refresh();
    }
  };

  const handleDeleteTemplate = async (template: any) => {
    const approved = await confirm({
      title: language === 'ar' ? 'حذف قالب العرض' : 'Delete Template',
      message:
        language === 'ar'
          ? `هل أنت متأكد من حذف القالب "${template.name}"؟ لن تتأثر العروض التي تم توليدها سابقًا.`
          : `Are you sure you want to delete template "${template.name}"? Existing generated proposals will remain safe.`,
      isDestructive: true,
    });
    if (!approved) return;

    const res = await deleteProposalTemplateAction(template.id);
    if (res.success) {
      router.refresh();
    }
  };

  const handleToggleTemplateActive = async (template: any) => {
    await updateProposalTemplateAction(template.id, { isActive: !template.isActive });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-600" />
            <span>{t('proposals.title')}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('proposals.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canManageTemplates && (
            <button
              type="button"
              onClick={() => {
                setEditingTemplate(null);
                setIsTemplateModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-brand-700 dark:text-brand-300 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-all shadow-sm"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'رفع قالب PDF جديد' : 'Upload Template'}</span>
            </button>
          )}

          {canCreate && (
            <Link
              href="/proposals/new"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-500/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('proposals.create')}</span>
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('proposals')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all -mb-px ${
            activeTab === 'proposals'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{language === 'ar' ? 'العروض المنشأة' : 'Generated Proposals'}</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-100 dark:bg-purple-950/80 text-brand-700 dark:text-brand-300">
            {initialProposals.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all -mb-px ${
            activeTab === 'templates'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{language === 'ar' ? 'قوالب الـ PDF القابلة للاستخدام' : 'Reusable Templates'}</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {initialTemplates.length}
          </span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeTab === 'proposals'
                ? language === 'ar'
                  ? 'البحث بالعنوان، اسم المدرسة، أو القالب...'
                  : 'Search by title, school, or template...'
                : language === 'ar'
                ? 'البحث في أسماء القوالب والملفات...'
                : 'Search templates by name or file...'
            }
            className="w-full ps-9 pe-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
          />
        </div>

        {activeTab === 'proposals' && (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Template Filter */}
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="py-2 px-3 rounded-xl text-xs bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500 flex-1 sm:flex-none max-w-[170px]"
            >
              <option value="ALL">{language === 'ar' ? 'جميع القوالب' : 'All Templates'}</option>
              {initialTemplates.map((tItem) => (
                <option key={tItem.id} value={tItem.id}>
                  {tItem.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="py-2 px-3 rounded-xl text-xs bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500 flex-1 sm:flex-none"
            >
              <option value="ALL">{language === 'ar' ? 'جميع الحالات' : 'All Statuses'}</option>
              <option value="DRAFT">{t('proposals.statusDraft')}</option>
              <option value="GENERATED">{t('proposals.statusGenerated')}</option>
              <option value="SENT">{t('proposals.statusSent')}</option>
            </select>
          </div>
        )}
      </div>

      {/* Tab 1: Proposals List */}
      {activeTab === 'proposals' && (
        <>
          {filteredProposals.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-brand-600 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                {t('proposals.noProposals')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
                {t('proposals.noProposalsDesc')}
              </p>
              {canCreate && (
                <Link
                  href="/proposals/new"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-500/20 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('proposals.create')}</span>
                </Link>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4 text-start">{language === 'ar' ? 'المعرف وعنوان العرض' : 'Proposal Ref & Title'}</th>
                      <th className="py-3 px-4 text-start">{language === 'ar' ? 'القالب المستخدم' : 'Template'}</th>
                      <th className="py-3 px-4 text-start">{t('proposals.status')}</th>
                      <th className="py-3 px-4 text-start">{language === 'ar' ? 'أنشئ بواسطة' : 'Created By'}</th>
                      <th className="py-3 px-4 text-start">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                      <th className="py-3 px-4 text-end">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredProposals.map((p) => {
                      const dateStr = new Date(p.createdAt).toLocaleDateString(language === 'ar' ? 'ar-JO' : 'en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      });

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-purple-50 dark:bg-purple-950/70 text-brand-700 dark:text-brand-300 border border-purple-200 dark:border-purple-800 shrink-0">
                                {formatProposalCode(p)}
                              </span>
                              <Link
                                href={`/proposals/${p.id}`}
                                className="font-bold text-slate-900 dark:text-white hover:text-brand-600 transition-colors block truncate max-w-[280px]"
                              >
                                {p.title}
                              </Link>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {p.template ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300">
                                <Layers className="w-3 h-3 text-brand-500 shrink-0" />
                                <span className="truncate max-w-[140px]">{p.template.name}</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                {language === 'ar' ? 'بدون قالب' : 'No Template'}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">{getStatusBadge(p.status)}</td>

                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">
                            {p.createdBy?.name || 'System'}
                          </td>

                          <td className="py-3 px-4 text-slate-500 font-medium whitespace-nowrap">
                            {dateStr}
                          </td>

                          <td className="py-3 px-4 text-end">
                            <div className="flex items-center justify-end gap-1.5">
                              {canGenerate && (
                                <>
                                  <a
                                    href={`/api/proposals/${p.id}/preview`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title={language === 'ar' ? 'معاينة العرض' : 'Preview'}
                                    className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </a>

                                  <a
                                    href={`/api/proposals/${p.id}/download`}
                                    download
                                    title={t('proposals.downloadPdf')}
                                    className="p-1.5 rounded-lg text-brand-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors"
                                  >
                                    <Download className="w-4 h-4" />
                                  </a>
                                </>
                              )}

                              {canEdit && (
                                <Link
                                  href={`/proposals/${p.id}`}
                                  title={t('common.edit')}
                                  className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                  <Edit className="w-4 h-4" />
                                </Link>
                              )}

                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProposal(p)}
                                  title={t('common.delete')}
                                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Tab 2: Reusable Templates List */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {filteredTemplates.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-brand-600 flex items-center justify-center mx-auto mb-3">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                {language === 'ar' ? 'لا توجد قوالب PDF مضافة حاليًا' : 'No PDF templates uploaded yet'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
                {language === 'ar'
                  ? 'ارفع أول قالب بصيغة PDF (مثلاً: عروض المدارس، البرمجة، التدريب) لإعادة استخدامه مرارًا.'
                  : 'Upload your first base PDF template to easily create customized proposals in one click.'}
              </p>
              {canManageTemplates && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTemplate(null);
                    setIsTemplateModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-500/20 transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'رفع قالب PDF جديد' : 'Upload Template'}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-3 hover:border-purple-300 dark:hover:border-purple-800 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-brand-600">
                          <FileCheck className="w-4 h-4" />
                        </span>
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[170px]">
                          {tmpl.name}
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleTemplateActive(tmpl)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                          tmpl.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                            : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {tmpl.isActive
                          ? language === 'ar'
                            ? 'نشط'
                            : 'Active'
                          : language === 'ar'
                          ? 'معطل'
                          : 'Inactive'}
                      </button>
                    </div>

                    {tmpl.description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                        {tmpl.description}
                      </p>
                    )}

                    <div className="text-[10px] text-slate-400 space-y-0.5 pt-1">
                      <div>{tmpl.originalFileName} ({(tmpl.fileSize / (1024 * 1024)).toFixed(2)} MB)</div>
                      <div>
                        {language === 'ar' ? 'العروض المنشأة من هذا القالب: ' : 'Proposals generated: '}
                        <span className="font-bold text-brand-600">{tmpl._count?.proposals || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                    <a
                      href={`/api/proposals/templates/${tmpl.id}/download`}
                      download
                      className="text-[11px] font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'تحميل الـ PDF الأصلي' : 'Download Original'}</span>
                    </a>

                    {canManageTemplates && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTemplate(tmpl);
                            setIsTemplateModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title={language === 'ar' ? 'تعديل القالب' : 'Edit Template'}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(tmpl)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload/Edit Template Modal */}
      {isTemplateModalOpen && (
        <TemplateModal
          isOpen={isTemplateModalOpen}
          template={editingTemplate}
          onClose={() => {
            setIsTemplateModalOpen(false);
            setEditingTemplate(null);
          }}
          onSuccess={() => {
            setIsTemplateModalOpen(false);
            setEditingTemplate(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}