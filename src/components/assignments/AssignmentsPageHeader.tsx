'use client';

import { useI18n } from '@/lib/i18n/context';

export function AssignmentsPageHeader() {
  const { language } = useI18n();
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
        {language === 'ar' ? 'محرك التعيينات' : 'Assignment Workspace'}
      </h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
        {language === 'ar'
          ? 'وزّع عناصر العمل على أعضاء الفريق وأنشئ تذاكر متابعة فردية مع تسجيل كامل للتدقيق.'
          : 'Distribute work items across team members and generate individual follow-up tickets with complete audit tracing.'}
      </p>
    </div>
  );
}
