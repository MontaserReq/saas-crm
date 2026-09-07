import { Language } from './i18n/translations';

/**
 * Standardized localized number formatter
 * Ensures consistent numbers formatting (e.g., standard digits or localized grouping)
 */
export function formatNumber(num: number | string | null | undefined, lang: Language = 'en'): string {
  if (num === null || num === undefined || num === '') return '0';
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return '0';

  return new Intl.NumberFormat(lang === 'ar' ? 'ar-JO' : 'en-US').format(n);
}

/**
 * Formats duration in minutes to human readable string (e.g. 2h 15m or 2 ساعة 15 دقيقة)
 */
export function formatDuration(minutes: number, lang: Language = 'en'): string {
  if (minutes < 1) return lang === 'ar' ? '< 1 دقيقة' : '< 1 min';
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;

  if (lang === 'ar') {
    if (hours > 0 && remainingMins > 0) {
      return `${hours} ساعة و ${remainingMins} دقيقة`;
    }
    if (hours > 0) {
      return `${hours} ساعة`;
    }
    return `${remainingMins} دقيقة`;
  }

  if (hours > 0 && remainingMins > 0) {
    return `${hours}h ${remainingMins}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${remainingMins}m`;
}
