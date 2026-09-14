'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useI18n } from '@/lib/i18n/context';
import { createSchoolAction, updateSchoolAction } from '@/server/actions/schools';
import { AlertCircle, User, Award } from 'lucide-react';

interface SchoolFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  school?: any;
  users?: Array<{ id: string; name: string; email: string }>;
  onSuccess?: () => void;
}

export function SchoolFormModal({
  isOpen,
  onClose,
  school,
  users = [],
  onSuccess,
}: SchoolFormModalProps) {
  const isEditing = !!school;
  const { t, language } = useI18n();

  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    whatsapp: '',
    email: '',
    city: 'Amman',
    area: '',
    classification: 'B',
    responsibleEmployeeId: '',
    status: 'ACTIVE',
  });

  useEffect(() => {
    if (school) {
      setFormData({
        name: school.name || '',
        contactPerson: school.contactPerson || '',
        phone: school.phone || '',
        whatsapp: school.whatsapp || '',
        email: school.email || '',
        city: school.city || 'Amman',
        area: school.area || '',
        classification: school.classification || 'B',
        responsibleEmployeeId: school.responsibleEmployeeId || '',
        status: school.status || 'ACTIVE',
      });
    } else {
      setFormData({
        name: '',
        contactPerson: '',
        phone: '',
        whatsapp: '',
        email: '',
        city: 'Amman',
        area: '',
        classification: 'B',
        responsibleEmployeeId: '',
        status: 'ACTIVE',
      });
    }
  }, [school, isOpen]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      name: formData.name.trim(),
      contactPerson: formData.contactPerson.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      whatsapp: formData.whatsapp.trim() || undefined,
      email: formData.email.trim() || undefined,
      city: formData.city.trim(),
      area: formData.area.trim() || undefined,
      classification: formData.classification as 'A' | 'B' | 'C',
      responsibleEmployeeId: formData.responsibleEmployeeId || undefined,
      status: formData.status as 'ACTIVE' | 'INACTIVE',
    };

    const res = isEditing
      ? await updateSchoolAction(school.id, payload)
      : await createSchoolAction(payload);

    setLoading(false);

    if (res.success) {
      if (isEditing && (res as any).pending) {
        setSuccessMessage(language === 'ar' ? 'تم إرسال طلب تعديل بيانات المدرسة، والطلب الآن بانتظار موافقة المسؤول.' : 'The school update request has been submitted and is pending administrator approval.');
        window.setTimeout(() => { onClose(); if (onSuccess) onSuccess(); }, 1400);
      } else {
        onClose();
        if (onSuccess) onSuccess();
      }
    } else {
      setError(res.error || t('common.error'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t('schools.editSchool') : t('schools.addSchool')}
      description={t('schools.schoolFormDesc')}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMessage && <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300 text-xs font-semibold">{successMessage}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('schools.schoolName')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          {/* Classification (A, B, C) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-brand-600" />
              <span>{t('schools.classification')} *</span>
            </label>
            <select
              value={formData.classification}
              onChange={(e) => setFormData({ ...formData, classification: e.target.value })}
              required
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="A">{t('schools.classA')}</option>
              <option value="B">{t('schools.classB')}</option>
              <option value="C">{t('schools.classC')}</option>
            </select>
          </div>

          {/* Responsible Employee Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-brand-600" />
              <span>{t('schools.responsibleEmployee')}</span>
            </label>
            <select
              value={formData.responsibleEmployeeId}
              onChange={(e) => setFormData({ ...formData, responsibleEmployeeId: e.target.value })}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="">{t('schools.selectResponsibleEmployee')}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('schools.contactPerson')}
            </label>
            <input
              type="text"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('schools.phone')}
            </label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder={t('schools.phoneHint')}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-slate-400">{t('schools.phoneHint')}</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('schools.whatsapp')}
            </label>
            <input
              type="text"
              value={formData.whatsapp}
              onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('schools.email')}
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('schools.city')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('schools.area')}
            </label>
            <input
              type="text"
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {loading ? t('common.loading') : isEditing ? t('common.update') : t('schools.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
