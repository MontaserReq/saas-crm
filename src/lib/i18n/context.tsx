"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { translations, Language } from "./translations";
import { localizeErrorMessage } from "./errorMessages";

interface I18nContextType {
  language: Language;
  direction: "rtl" | "ltr";
  setLanguage: (lang: Language) => void;
  t: (keyPath: string, params?: Record<string, string | number>) => string;
  getStatusLabel: (statusKey: string) => string;
  getPriorityLabel: (priorityKey: string) => string;
  getRoleLabel: (roleKey: string) => string;
  errorMessage: (error: unknown, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: React.ReactNode;
  preferenceScope?: string;
}

export function I18nProvider({
  children,
  preferenceScope = "guest",
}: I18nProviderProps) {
  const [language, setLanguageState] = useState<Language>("ar");
  const languageStorageKey = `satrcrm:language:${preferenceScope}`;

  useEffect(() => {
    const saved = localStorage.getItem(languageStorageKey) as Language;
    if (saved && (saved === "en" || saved === "ar")) {
      setLanguageState(saved);
      document.documentElement.lang = saved;
      document.documentElement.dir = saved === "ar" ? "rtl" : "ltr";
    } else {
      document.documentElement.lang = "ar";
      document.documentElement.dir = "rtl";
    }
  }, [languageStorageKey]);

  useEffect(() => {
    const validationText = (
      element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
    ) => {
      const validity = element.validity;
      if (validity.valueMissing)
        return language === "ar"
          ? "يرجى تعبئة هذا الحقل."
          : "Complete this field.";
      if (validity.typeMismatch && element instanceof HTMLInputElement) {
        if (element.type === "email")
          return language === "ar"
            ? "أدخل بريدًا إلكترونيًا صالحًا."
            : "Enter a valid email address.";
        if (element.type === "url")
          return language === "ar"
            ? "أدخل رابطًا صالحًا."
            : "Enter a valid URL.";
      }
      if (
        validity.tooShort &&
        (element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement)
      )
        return language === "ar"
          ? `يجب ألا يقل النص عن ${element.minLength} أحرف.`
          : `Use at least ${element.minLength} characters.`;
      if (
        validity.tooLong &&
        (element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement)
      )
        return language === "ar"
          ? `يجب ألا يزيد النص عن ${element.maxLength} أحرف.`
          : `Use no more than ${element.maxLength} characters.`;
      if (validity.rangeUnderflow && element instanceof HTMLInputElement)
        return language === "ar"
          ? `يجب ألا تقل القيمة عن ${element.min}.`
          : `The value must be at least ${element.min}.`;
      if (validity.rangeOverflow && element instanceof HTMLInputElement)
        return language === "ar"
          ? `يجب ألا تزيد القيمة عن ${element.max}.`
          : `The value must be no more than ${element.max}.`;
      if (validity.patternMismatch)
        return language === "ar"
          ? "القيمة المدخلة لا تطابق الصيغة المطلوبة."
          : "The value does not match the required format.";
      return language === "ar"
        ? "تحقق من القيمة المدخلة."
        : "Check the value entered.";
    };

    const handleInvalid = (event: Event) => {
      const element = event.target;
      if (!(
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      ))
        return;
      element.setCustomValidity(validationText(element));
      element.dataset.i18nValidation = "true";
    };
    const clearValidation = (event: Event) => {
      const element = event.target;
      if (
        (element instanceof HTMLInputElement ||
          element instanceof HTMLSelectElement ||
          element instanceof HTMLTextAreaElement) &&
        element.dataset.i18nValidation === "true"
      ) {
        element.setCustomValidity("");
        delete element.dataset.i18nValidation;
      }
    };

    document.addEventListener("invalid", handleInvalid, true);
    document.addEventListener("input", clearValidation, true);
    document.addEventListener("change", clearValidation, true);
    return () => {
      document.removeEventListener("invalid", handleInvalid, true);
      document.removeEventListener("input", clearValidation, true);
      document.removeEventListener("change", clearValidation, true);
    };
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(languageStorageKey, lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  };

  const direction = language === "ar" ? "rtl" : "ltr";

  const t = (
    keyPath: string,
    params?: Record<string, string | number>,
  ): string => {
    const keys = keyPath.split(".");
    let current: any = translations[language];
    for (const k of keys) {
      if (current && typeof current === "object" && k in current) {
        current = current[k];
      } else {
        // Fallback to English
        let fallback: any = translations["en"];
        for (const fk of keys) {
          if (fallback && typeof fallback === "object" && fk in fallback) {
            fallback = fallback[fk];
          } else {
            return keyPath;
          }
        }
        const result = typeof fallback === "string" ? fallback : keyPath;
        if (params) {
          return result.replace(/\{(\w+)\}/g, (_, key) =>
            String(params[key] ?? `{${key}}`),
          );
        }
        return result;
      }
    }
    const result = typeof current === "string" ? current : keyPath;
    if (params) {
      return result.replace(/\{(\w+)\}/g, (_, key) =>
        String(params[key] ?? `{${key}}`),
      );
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

  const errorMessage = (error: unknown, fallback?: string): string =>
    localizeErrorMessage(error, language, fallback);

  return (
    <I18nContext.Provider
      value={{
        language,
        direction,
        setLanguage,
        t,
        getStatusLabel,
        getPriorityLabel,
        getRoleLabel,
        errorMessage,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
