import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BRAND_COLOR,
  getBrandPalette,
  getBrandThemeCss,
  isValidBrandColor,
  normalizeBrandColor,
} from '@/lib/branding';

describe('organization brand theme', () => {
  it('keeps the configured color as the primary brand shade and derives a full palette', () => {
    const theme = getBrandPalette('#2563EB');

    expect(theme.primaryColor).toBe('#2563eb');
    expect(theme.palette[600]).toBe('37 99 235');
    expect(theme.palette[50]).toBe('244 247 254');
    expect(theme.palette[950]).toBe('13 36 85');
  });

  it('falls back safely when a stored color is absent or malformed', () => {
    expect(normalizeBrandColor(null)).toBe(DEFAULT_BRAND_COLOR);
    expect(normalizeBrandColor('red;--background:black')).toBe(DEFAULT_BRAND_COLOR);
    expect(isValidBrandColor('#16a34a')).toBe(true);
    expect(isValidBrandColor('#fff')).toBe(false);
  });

  it('only emits parsed RGB values in the organization theme stylesheet', () => {
    const css = getBrandThemeCss('red;}body{display:none');

    expect(css).toContain('--brand-600:72 32 128');
    expect(css).not.toContain('display:none');
    expect(css).toContain('.dark{');
  });
});
