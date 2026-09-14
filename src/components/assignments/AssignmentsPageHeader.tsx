'use client';

import { useI18n } from '@/lib/i18n/context';

export function AssignmentsPageHeader() {
  const { language } = useI18n();
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
        {language === 'ar' ? 'محرك توزيع المدارس' : 'School Assignment Engine'}
      </h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
        {language === 'ar'
          ? 'اختر المدارس المستهدفة ووزّعها على أعضاء فريق العلاقات العامة. يتم إنشاء تذكرة واحدة لكل مدرسة مع تسجيل كامل للتدقيق.'
          : 'Select target schools and distribute them across PR team members. Exactly 1 individual ticket is generated per school with complete audit tracing.'}
      </p>
    </div>
  );
}
