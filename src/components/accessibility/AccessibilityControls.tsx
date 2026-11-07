"use client";

import { useEffect, useId, useState } from "react";
import { Accessibility, Check, Contrast, Eye, Minus, RotateCcw, Underline } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";

type TextSize = "normal" | "large" | "xlarge";

const STORAGE_KEY = "satrcrm:accessibility";

interface AccessibilityPreferences {
  textSize: TextSize;
  highContrast: boolean;
  reducedMotion: boolean;
  underlineLinks: boolean;
}

const defaults: AccessibilityPreferences = {
  textSize: "normal",
  highContrast: false,
  reducedMotion: false,
  underlineLinks: false,
};

function applyPreferences(preferences: AccessibilityPreferences) {
  const root = document.documentElement;
  root.classList.toggle("a11y-large-text", preferences.textSize === "large");
  root.classList.toggle("a11y-xlarge-text", preferences.textSize === "xlarge");
  root.classList.toggle("a11y-high-contrast", preferences.highContrast);
  root.classList.toggle("a11y-reduced-motion", preferences.reducedMotion);
  root.classList.toggle("a11y-underline-links", preferences.underlineLinks);
}

export function AccessibilityControls() {
  const { language } = useI18n();
  const [open, setOpen] = useState(false);
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(defaults);
  const panelId = useId();
  const isArabic = language === "ar";

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as Partial<AccessibilityPreferences> | null;
      const next = { ...defaults, ...saved };
      setPreferences(next);
      applyPreferences(next);
    } catch {
      applyPreferences(defaults);
    }
  }, []);

  const update = (next: Partial<AccessibilityPreferences>) => {
    const updated = { ...preferences, ...next };
    setPreferences(updated);
    applyPreferences(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const reset = () => update(defaults);
  const sizeLabel = preferences.textSize === "normal" ? (isArabic ? "عادي" : "Normal") : preferences.textSize === "large" ? (isArabic ? "كبير" : "Large") : (isArabic ? "أكبر" : "Extra large");

  return (
    <div className="fixed bottom-4 start-20 z-[60] print:hidden">
      {open && (
        <section id={panelId} aria-label={isArabic ? "إعدادات سهولة الاستخدام" : "Accessibility settings"} className="-ms-16 mb-3 w-[min(21rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-black">{isArabic ? "سهولة الاستخدام" : "Accessibility"}</h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{isArabic ? "خصّص طريقة عرض الموقع لتناسبك." : "Adjust the site to work better for you."}</p>
            </div>
            <Accessibility className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
          </div>

          <fieldset className="border-0 p-0">
            <legend className="mb-2 text-xs font-bold">{isArabic ? "حجم النص" : "Text size"}</legend>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={isArabic ? "حجم النص" : "Text size"}>
              {(["normal", "large", "xlarge"] as TextSize[]).map((size) => (
                <button key={size} type="button" aria-pressed={preferences.textSize === size} onClick={() => update({ textSize: size })} className="min-h-10 rounded-xl border border-slate-300 px-2 text-xs font-bold transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 aria-pressed:border-brand-600 aria-pressed:bg-brand-50 aria-pressed:text-brand-700 dark:border-slate-600 dark:hover:bg-slate-800 dark:aria-pressed:bg-brand-950 dark:aria-pressed:text-brand-200">
                  {size === "normal" ? "A" : size === "large" ? "A+" : "A++"} <span className="sr-only">{size === preferences.textSize ? sizeLabel : size}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-3 grid gap-2">
            <button type="button" aria-pressed={preferences.highContrast} onClick={() => update({ highContrast: !preferences.highContrast })} className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 text-start text-xs font-bold transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-700 dark:hover:bg-slate-800">
              <Contrast className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
              <span className="flex-1">{isArabic ? "تباين عالٍ" : "High contrast"}</span>
              {preferences.highContrast && <Check className="h-4 w-4 text-emerald-600" aria-label={isArabic ? "مفعّل" : "On"} />}
            </button>
            <button type="button" aria-pressed={preferences.reducedMotion} onClick={() => update({ reducedMotion: !preferences.reducedMotion })} className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 text-start text-xs font-bold transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-700 dark:hover:bg-slate-800">
              <Eye className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
              <span className="flex-1">{isArabic ? "تقليل الحركة" : "Reduce motion"}</span>
              {preferences.reducedMotion && <Check className="h-4 w-4 text-emerald-600" aria-label={isArabic ? "مفعّل" : "On"} />}
            </button>
            <button type="button" aria-pressed={preferences.underlineLinks} onClick={() => update({ underlineLinks: !preferences.underlineLinks })} className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 text-start text-xs font-bold transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-700 dark:hover:bg-slate-800">
              <Underline className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
              <span className="flex-1">{isArabic ? "تسطير الروابط" : "Underline links"}</span>
              {preferences.underlineLinks && <Check className="h-4 w-4 text-emerald-600" aria-label={isArabic ? "مفعّل" : "On"} />}
            </button>
          </div>

          <button type="button" onClick={reset} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {isArabic ? "إعادة الإعدادات" : "Reset settings"}
          </button>
        </section>
      )}

      <button type="button" aria-expanded={open} aria-controls={panelId} aria-label={isArabic ? "فتح إعدادات سهولة الاستخدام" : "Open accessibility settings"} onClick={() => setOpen((value) => !value)} className="grid h-12 w-12 place-items-center rounded-full bg-brand-700 text-white shadow-lg shadow-brand-900/25 transition hover:bg-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
        {open ? <Minus className="h-5 w-5" aria-hidden="true" /> : <Accessibility className="h-6 w-6" aria-hidden="true" />}
      </button>
    </div>
  );
}
