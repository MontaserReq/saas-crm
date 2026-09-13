'use client';

import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { SchoolFormModal } from './SchoolFormModal';
import { PhoneNumber } from '@/components/ui/PhoneNumber';
import { SchoolImportModal } from './SchoolImportModal';
import { ExportDropdown } from '@/components/ui/ExportDropdown';
import { deleteSchoolAction } from '@/server/actions/schools';
import { formatNumber } from '@/lib/formatters';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  Plus,
  Upload,
  Search,
  Building2,
  Phone,
  MapPin,
  MessageCircle,
  GraduationCap,
  CheckCircle2,
  Layers,
  Award,
  User,
  Trash2,
  Edit,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

interface SchoolsClientViewProps {
  initialSchools: any[];
  total: number;
  totalAllSchools?: number;
  totalAssignedSchools?: number;
  totalClassA?: number;
  page: number;
  pageSize?: number | string;
  totalPages: number;
  canCreate?: boolean;
  canImport?: boolean;
  canAssign?: boolean;
  canDelete?: boolean;
  initialSearch?: string;
  initialCity?: string;
  initialClassification?: string;
  users?: Array<{ id: string; name: string; email: string }>;
}

export function SchoolsClientView({
  initialSchools,
  total,
  totalAllSchools,
  totalAssignedSchools = 0,
  totalClassA = 0,
  page,
  pageSize = 15,
  totalPages,
  canCreate = true,
  canImport = true,
  canAssign = true,
  canDelete = false,
  initialSearch = '',
  initialCity = '',
  initialClassification = '',
  users = [],
}: SchoolsClientViewProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<any | null>(null);
  const [deletingSchool, setDeletingSchool] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const { t, language } = useI18n();
  const router = useRouter();
  const grandTotal = totalAllSchools !== undefined ? totalAllSchools : total;
  const isAll = pageSize === 'all' || (typeof pageSize === 'number' && pageSize >= 10000);
  const numericPageSize = isAll ? (total || 15) : (typeof pageSize === 'number' ? pageSize : parseInt(String(pageSize), 10) || 15);
  const startRecord = total === 0 ? 0 : (page - 1) * numericPageSize + 1;
  const endRecord = total === 0 ? 0 : Math.min(startRecord + initialSchools.length - 1, total);

  const buildUrl = (targetPage: number, targetPageSize?: string | number) => {
    const params = new URLSearchParams();
    if (targetPage > 1) params.set('page', String(targetPage));
    const effectiveSize = targetPageSize !== undefined ? targetPageSize : pageSize;
    if (effectiveSize && effectiveSize !== 15 && effectiveSize !== '15') {
      params.set('pageSize', String(effectiveSize));
    }
    if (initialSearch) params.set('search', initialSearch);
    if (initialClassification) params.set('classification', initialClassification);
    if (initialCity) params.set('city', initialCity);
    const qs = params.toString();
    return `/schools${qs ? `?${qs}` : ''}`;
  };

  const handlePageSizeChange = (newSize: string) => {
    if (newSize === 'custom') {
      const input = prompt(language === 'ar' ? 'أدخل عدد المدارس المطلوب عرضها بالصفحة (مثال: 50):' : 'Enter number of schools per page:');
      if (input) {
        const parsed = parseInt(input.trim(), 10);
        if (!isNaN(parsed) && parsed > 0) {
          router.push(buildUrl(1, Math.min(parsed, 10000)));
        }
      }
      return;
    }
    router.push(buildUrl(1, newSize));
  };

  const getPaginationRange = (current: number, totalCount: number) => {
    if (totalCount <= 7) {
      return Array.from({ length: totalCount }, (_, i) => i + 1);
    }
    if (current <= 4) {
      return [1, 2, 3, 4, 5, '...', totalCount];
    }
    if (current >= totalCount - 3) {
      return [1, '...', totalCount - 4, totalCount - 3, totalCount - 2, totalCount - 1, totalCount];
    }
    return [1, '...', current - 1, current, current + 1, '...', totalCount];
  };

  const downloadTemplate = () => {
    const headers = ['School Name', 'Contact Person', 'Area / City', 'School Classification', 'Phone Number', 'Email', 'Last Contact Result / Call Details', 'School Status'];
    const example = ['Example School', 'Contact person', 'Amman', 'A', '+962 7 9000 0000', 'school@example.com', 'Initial contact pending', 'ACTIVE'];
    const worksheet = XLSX.utils.aoa_to_sheet([headers, example]);
    worksheet['!cols'] = headers.map(() => ({ wch: 28 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Schools');
    XLSX.writeFile(workbook, 'school-registry-template.xlsx');
  };

  const handleDeleteConfirm = async () => {
    if (!deletingSchool) return;
    setDeleteLoading(true);
    const res = await deleteSchoolAction(deletingSchool.id);
    setDeleteLoading(false);
    setDeletingSchool(null);
    if (res.success) {
      if (res.pending) setNotice(language === 'ar' ? 'تم إرسال طلب حذف المدرسة وبانتظار موافقة المسؤول.' : 'The school deletion request has been submitted and is pending administrator approval.');
      router.refresh();
    }
  };

  const getClassificationBadge = (cls?: string | null) => {
    switch (cls) {
      case 'A':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-[10px] font-bold">
            <Award className="w-3 h-3 text-amber-600" />
            <span>{t('schools.classA')}</span>
          </span>
        );
      case 'B':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700 text-[10px] font-bold">
            <span>{t('schools.classB')}</span>
          </span>
        );
      case 'C':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-[10px] font-bold">
            <span>{t('schools.classC')}</span>
          </span>
        );
      default:
        if (!cls || cls.trim() === '') {
          return <span className="text-slate-400 italic text-[11px]">—</span>;
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold">
            <span>{cls}</span>
          </span>
        );
    }
  };

  const exportColumns = [
    { header: t('schools.schoolName'), accessor: (s: any) => s.name },
    { header: t('schools.classification'), accessor: (s: any) => s.classification ? `Class ${s.classification}` : '—' },
    { header: t('schools.responsibleEmployee'), accessor: (s: any) => s.responsibleEmployee?.name || '—' },
    { header: t('schools.contactPerson'), accessor: (s: any) => s.contactPerson || '—' },
    { header: t('schools.phone'), accessor: (s: any) => s.phone || '—' },
    { header: t('schools.whatsapp'), accessor: (s: any) => s.whatsapp || '—' },
    { header: t('schools.city'), accessor: (s: any) => s.city },
    { header: t('schools.area'), accessor: (s: any) => s.area || '—' },
  ];

  return (
    <div className="space-y-6">
      {notice && <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold">{notice}</div>}
      {/* Header with primary actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('schools.title')}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('schools.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExportDropdown
            data={initialSchools}
            columns={exportColumns}
            filename="schools_registry"
            title={t('schools.title')}
          />

          {canAssign && (
            <Link
              href="/assignments"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-colors"
            >
              <span>{t('schools.assignSchoolsAction')}</span>
            </Link>
          )}

          {canImport && (
            <>
              <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand-500 transition-colors shadow-sm">{language === 'ar' ? 'تحميل نموذج Excel' : 'Download Template'}</button>
              <button onClick={() => setIsImportOpen(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand-500 transition-colors shadow-sm"><Upload className="w-3.5 h-3.5 text-brand-600" /><span>{t('schools.importSchools')}</span></button>
            </>
          )}

          {canCreate && (
            <button
              onClick={() => {
                setEditingSchool(null);
                setIsAddOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-500/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('schools.addSchool')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Prominent Schools Counter Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Main Grand Total Card */}
        <div className="bg-gradient-to-br from-brand-600 to-purple-800 text-white rounded-2xl p-5 shadow-lg shadow-brand-600/15 flex items-center justify-between relative overflow-hidden">
          <div className="space-y-1 relative z-10">
            <span className="text-xs font-semibold text-purple-200 block uppercase tracking-wider">
              {t('schools.totalSchoolsCard')}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight">{formatNumber(grandTotal, language)}</span>
              <span className="text-xs text-purple-200 font-medium">{t('schools.registeredSchools')}</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center relative z-10">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Assigned Schools */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
              {t('schools.assignedSchoolsCard')}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {formatNumber(totalAssignedSchools, language)}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">{t('schools.activeCampaigns')}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-brand-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Class A High Priority */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
              {t('schools.classA')}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {formatNumber(totalClassA, language)}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">{t('schools.classification')}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
        </div>

        {/* Filtered Search Results Count */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
              {t('schools.searchResultsCard')}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-brand-600 dark:text-brand-400">
                {formatNumber(total, language)}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">{t('schools.inCurrentView')}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <form method="GET" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              name="search"
              defaultValue={initialSearch}
              placeholder={t('schools.searchPlaceholder')}
              className="w-full pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <select
              name="classification"
              defaultValue={initialClassification}
              className="w-full py-2 px-3 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="">{t('schools.allClassifications')}</option>
              <option value="A">{t('schools.classA')}</option>
              <option value="B">{t('schools.classB')}</option>
              <option value="C">{t('schools.classC')}</option>
            </select>
          </div>

          <div>
            <select
              name="pageSize"
              defaultValue={String(pageSize)}
              className="w-full py-2 px-3 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500 font-medium"
            >
              <option value="10">10 {language === 'ar' ? 'مدارس بالصفحة' : 'per page'}</option>
              <option value="15">15 {language === 'ar' ? 'مدرسة بالصفحة (افتراضي)' : 'per page (default)'}</option>
              <option value="25">25 {language === 'ar' ? 'مدرسة بالصفحة' : 'per page'}</option>
              <option value="36">36 {language === 'ar' ? 'مدرسة بالصفحة' : 'per page'}</option>
              <option value="50">50 {language === 'ar' ? 'مدرسة بالصفحة' : 'per page'}</option>
              <option value="100">100 {language === 'ar' ? 'مدرسة بالصفحة' : 'per page'}</option>
              <option value="250">250 {language === 'ar' ? 'مدرسة بالصفحة' : 'per page'}</option>
              <option value="500">500 {language === 'ar' ? 'مدرسة بالصفحة' : 'per page'}</option>
              <option value="all">{language === 'ar' ? 'عرض جميع المدارس (الكل)' : 'Show All Schools'}</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="w-full py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors shadow-sm"
            >
              {t('schools.filterAction')}
            </button>
            <Link
              href="/schools"
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              {t('schools.reset')}
            </Link>
          </div>
        </form>
      </div>

      {/* Schools Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {initialSchools.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Building2 className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold">{t('schools.noSchoolsFound')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right border-collapse text-xs">
              <thead>
                <tr className="hidden md:table-row bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">{t('schools.schoolName')}</th>
                  <th className="py-3 px-4">{t('schools.classification')}</th>
                  <th className="py-3 px-4">{t('schools.responsibleEmployee')}</th>
                  <th className="py-3 px-4">{t('schools.contactPerson')}</th>
                  <th className="py-3 px-4">
                    {t('schools.phone')} & {t('schools.whatsapp')}
                  </th>
                  <th className="py-3 px-4">{t('schools.city')}</th>
                  <th className="py-3 px-4 text-center">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {initialSchools.map((s) => {
                  const pendingBadges = s.pendingApprovalRequests?.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.pendingApprovalRequests.map((request: any) => (
                        <span key={request.type} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${request.type === 'DELETE' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800'}`}>
                          🟡 {request.type === 'DELETE' ? (language === 'ar' ? 'طلب حذف بانتظار الموافقة' : 'Deletion Request Pending Approval') : (language === 'ar' ? 'طلب تعديل بانتظار الموافقة' : 'Edit Request Pending Approval')}
                        </span>
                      ))}
                    </div>
                  );
                  const editButton = (
                    <button
                      disabled={s.pendingApprovalRequests?.some((request: any) => request.type === 'EDIT')}
                      onClick={() => {
                        setEditingSchool(s);
                        setIsAddOpen(true);
                      }}
                      className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
                      title={s.pendingApprovalRequests?.some((request: any) => request.type === 'EDIT') ? 'View Pending Request' : t('common.edit')}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  );
                  const deleteButton = canDelete && (
                    <button
                      disabled={s.pendingApprovalRequests?.some((request: any) => request.type === 'DELETE')}
                      onClick={() => setDeletingSchool(s)}
                      className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 text-xs font-semibold transition-colors"
                      title={s.pendingApprovalRequests?.some((request: any) => request.type === 'DELETE') ? 'Deletion Request Pending Approval' : t('common.delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  );
                  return (
                  <React.Fragment key={s.id}>
                    {/* Desktop row */}
                    <tr className="hidden md:table-row border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                        <div>{s.name}</div>
                        {pendingBadges}
                        {s._count?.tickets > 0 && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            {formatNumber(s._count.tickets, language)} {t('tickets.title')}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">{getClassificationBadge(s.classification)}</td>

                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                        {s.responsibleEmployee ? (
                          <div className="flex items-center gap-1.5 font-medium text-purple-700 dark:text-purple-300">
                            <User className="w-3.5 h-3.5 text-brand-600" />
                            <span>{s.responsibleEmployee.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            {t('schools.unassignedEmployee')}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                        {s.contactPerson || '—'}
                      </td>

                      <td className="py-3.5 px-4 space-y-0.5">
                        {s.phone && (
                          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                            <Phone className="w-3 h-3 text-brand-600" />
                            <PhoneNumber value={s.phone} href={`tel:${s.phone}`} />
                          </div>
                        )}
                        {s.whatsapp && (
                          <div className="flex items-center gap-1 text-emerald-600 font-medium">
                            <MessageCircle className="w-3 h-3" />
                            <PhoneNumber value={s.whatsapp} href={`https://wa.me/${s.whatsapp.replace(/[^0-9]/g, '')}`} />
                          </div>
                        )}
                        {!s.phone && !s.whatsapp && <span className="text-slate-400">—</span>}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>
                            {s.city} {s.area ? `(${s.area})` : ''}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {editButton}
                          {deleteButton}
                        </div>
                      </td>
                    </tr>

                    {/* Mobile card */}
                    <tr className="md:hidden border-b border-slate-100 dark:border-slate-800">
                      <td colSpan={7} className="p-4 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">{s.name}</div>
                            {s._count?.tickets > 0 && (
                              <span className="text-[10px] text-slate-400 font-normal">
                                {formatNumber(s._count.tickets, language)} {t('tickets.title')}
                              </span>
                            )}
                          </div>
                          <div className="shrink-0">{getClassificationBadge(s.classification)}</div>
                        </div>
                        {pendingBadges}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <User className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                            <span className="truncate">{s.responsibleEmployee?.name || t('schools.unassignedEmployee')}</span>
                          </div>
                          <div className="flex items-center gap-1 min-w-0">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{s.city} {s.area ? `(${s.area})` : ''}</span>
                          </div>
                          {s.phone && (
                            <div className="flex items-center gap-1 min-w-0">
                              <Phone className="w-3 h-3 text-brand-600 shrink-0" />
                              <PhoneNumber value={s.phone} href={`tel:${s.phone}`} />
                            </div>
                          )}
                          {s.whatsapp && (
                            <div className="flex items-center gap-1 min-w-0 text-emerald-600 font-medium">
                              <MessageCircle className="w-3 h-3 shrink-0" />
                              <PhoneNumber value={s.whatsapp} href={`https://wa.me/${s.whatsapp.replace(/[^0-9]/g, '')}`} />
                            </div>
                          )}
                          {s.contactPerson && (
                            <div className="min-w-0 truncate col-span-2">{s.contactPerson}</div>
                          )}
                        </div>
                        <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                          {editButton}
                          {deleteButton}
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination & Count Control Bar */}
        {initialSchools.length > 0 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-3 flex-wrap">
              <span>
                {language === 'ar'
                  ? `عرض ${formatNumber(startRecord, language)} إلى ${formatNumber(endRecord, language)} من أصل ${formatNumber(total, language)} مدرسة`
                  : `Showing ${startRecord} to ${endRecord} of ${total} schools`}
              </span>
              <div className="flex items-center gap-1.5 border-l rtl:border-l-0 rtl:border-r border-slate-200 dark:border-slate-700 pl-3 rtl:pl-0 rtl:pr-3">
                <span className="text-[11px] text-slate-400">{language === 'ar' ? 'عرض:' : 'Show:'}</span>
                <select
                  value={String(pageSize)}
                  onChange={(e) => handlePageSizeChange(e.target.value)}
                  className="py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:border-brand-500 font-semibold"
                >
                  <option value="10">10</option>
                  <option value="15">15</option>
                  <option value="25">25</option>
                  <option value="36">36</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="250">250</option>
                  <option value="500">500</option>
                  <option value="all">{language === 'ar' ? 'الكل' : 'All'}</option>
                  <option value="custom">{language === 'ar' ? 'مخصص...' : 'Custom...'}</option>
                </select>
              </div>
            </div>

            {totalPages > 1 && !isAll && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {page > 1 && (
                  <Link
                    href={buildUrl(page - 1)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold transition-colors"
                  >
                    {t('common.previous')}
                  </Link>
                )}
                {getPaginationRange(page, totalPages).map((p, idx) =>
                  typeof p === 'number' ? (
                    <Link
                      key={idx}
                      href={buildUrl(p)}
                      className={`min-w-[32px] h-8 px-2 flex items-center justify-center rounded-lg border text-xs font-bold transition-colors ${
                        p === page
                          ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {formatNumber(p, language)}
                    </Link>
                  ) : (
                    <span key={idx} className="px-1 text-slate-400 select-none">
                      ...
                    </span>
                  )
                )}
                {page < totalPages && (
                  <Link
                    href={buildUrl(page + 1)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold transition-colors"
                  >
                    {t('common.next')}
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <SchoolFormModal
        isOpen={isAddOpen}
        onClose={() => {
          setIsAddOpen(false);
          setEditingSchool(null);
        }}
        school={editingSchool}
        users={users}
        onSuccess={() => router.refresh()}
      />

      <SchoolImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />

      {/* Delete / Safe Archive Confirmation */}
      {deletingSchool && (
        <ConfirmDialog
          isOpen={!!deletingSchool}
          onClose={() => setDeletingSchool(null)}
          onConfirm={handleDeleteConfirm}
          title={language === 'ar' ? 'طلب حذف المدرسة' : 'Request school deletion'}
          description={language === 'ar' ? `سيتم إرسال طلب حذف ${deletingSchool.name} إلى المسؤول للموافقة. لن يتم حذف المدرسة الآن.` : `A deletion request for ${deletingSchool.name} will be sent to an administrator. The school will not be deleted yet.`}
          confirmText={language === 'ar' ? 'إرسال طلب الحذف' : 'Submit deletion request'}
          confirmVariant="danger"
          loading={deleteLoading}
        />
      )}
    </div>
  );
}
