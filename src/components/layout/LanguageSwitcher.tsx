'use client';

import { useI18n } from '@/lib/i18n/context';
import { Languages } from 'lucide-react';

export function LanguageSwitcher() {
  const { language, setLanguage } = useI18n();

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
      title="Switch Language / تغيير اللغة"
      aria-label="Switch Language"
    >
      <Languages className="w-4 h-4 text-brand-600 dark:text-brand-400" />
      <span>{language === 'ar' ? 'English' : 'العربية'}</span>
    </button>
  );
}
