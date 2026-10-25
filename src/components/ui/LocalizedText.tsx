"use client";

import { useI18n } from "@/lib/i18n/context";

export function LocalizedText({ en, ar }: { en: string; ar: string }) {
  const { language } = useI18n();
  return <>{language === "ar" ? ar : en}</>;
}
