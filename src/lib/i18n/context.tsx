'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Language } from './translations';

interface I18nContextType {
  language: Language;
  direction: 'rtl' | 'ltr';
  setLanguage: (lang: Language) => void;
  t: (keyPath: string, params?: Record<string, string | number>) => string;
  getStatusLabel: (statusKey: string) => string;
  getPriorityLabel: (priorityKey: string) => string;
  getRoleLabel: (roleKey: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ar');

  useEffect(() => {
    const saved = localStorage.getItem('codeline_lang') as Language;
    if (saved && (saved === 'en' || saved === 'ar')) {
      setLanguageState(saved);
      document.documentElement.lang = saved;
      document.documentElement.dir = saved === 'ar' ? 'rtl' : 'ltr';
    } else {
      document.documentElement.lang = 'ar';
      document.documentElement.dir = 'rtl';
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('codeline_lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  };

  const direction = language === 'ar' ? 'rtl' : 'ltr';

  const t = (keyPath: string, params?: Record<string, string | number>): string => {
    const keys = keyPath.split('.');
    let current: any = translations[language];
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        // Fallback to English
        let fallback: any = translations['en'];
        for (const fk of keys) {
          if (fallback && typeof fallback === 'object' && fk in fallback) {
            fallback = fallback[fk];
          } else {
            return keyPath;
          }
        }
        const result = typeof fallback === 'string' ? fallback : keyPath;
        if (params) {
          return result.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
        }
        return result;
      }
    }
    const result = typeof current === 'string' ? current : keyPath;
    if (params) {
      return result.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
    }
    return result;
  };

  const getStatusLabel = (statusKey: string): string => {
    const map = (translations[language] as any).statusMap || {};
    return map[statusKey] || statusKey;
  };

  const getPriorityLabel = (priorityKey: string): string => {
    const map = (translations[language] as any).statusMap || {};
    return map[priorityKey] || priorityKey;
  };

  const getRoleLabel = (roleKey: string): string => {
    const map = (translations[language] as any).statusMap || {};
    return map[roleKey] || roleKey;
  };

  return (
    <I18nContext.Provider
      value={{ language, direction, setLanguage, t, getStatusLabel, getPriorityLabel, getRoleLabel }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
