export const DEFAULT_BRAND_COLOR = '#482080';

export const BRAND_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

type Rgb = { r: number; g: number; b: number };

const SHADE_MIXES: Record<(typeof BRAND_SHADES)[number], { target: Rgb; amount: number }> = {
  50: { target: { r: 255, g: 255, b: 255 }, amount: 0.95 },
  100: { target: { r: 255, g: 255, b: 255 }, amount: 0.88 },
  200: { target: { r: 255, g: 255, b: 255 }, amount: 0.75 },
  300: { target: { r: 255, g: 255, b: 255 }, amount: 0.58 },
  400: { target: { r: 255, g: 255, b: 255 }, amount: 0.36 },
  500: { target: { r: 255, g: 255, b: 255 }, amount: 0.16 },
  600: { target: { r: 0, g: 0, b: 0 }, amount: 0 },
  700: { target: { r: 0, g: 0, b: 0 }, amount: 0.18 },
  800: { target: { r: 0, g: 0, b: 0 }, amount: 0.33 },
  900: { target: { r: 0, g: 0, b: 0 }, amount: 0.48 },
  950: { target: { r: 0, g: 0, b: 0 }, amount: 0.64 },
};

export function isValidBrandColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim());
}

export function normalizeBrandColor(value: string | null | undefined): string {
  return isValidBrandColor(value) ? value.trim().toLowerCase() : DEFAULT_BRAND_COLOR;
}

function hexToRgb(hex: string): Rgb {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function mix(color: Rgb, target: Rgb, amount: number): Rgb {
  return {
    r: Math.round(color.r + (target.r - color.r) * amount),
    g: Math.round(color.g + (target.g - color.g) * amount),
    b: Math.round(color.b + (target.b - color.b) * amount),
  };
}

function rgbValue(color: Rgb): string {
  return `${color.r} ${color.g} ${color.b}`;
}

function hslValue({ r, g, b }: Rgb): string {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }

  if (hue < 0) hue += 360;
  return `${Math.round(hue * 10) / 10} ${Math.round(saturation * 1000) / 10}% ${Math.round(lightness * 1000) / 10}%`;
}

export function getBrandPalette(value: string | null | undefined) {
  const primaryColor = normalizeBrandColor(value);
  const primary = hexToRgb(primaryColor);
  const palette = Object.fromEntries(
    BRAND_SHADES.map((shade) => [shade, rgbValue(mix(primary, SHADE_MIXES[shade].target, SHADE_MIXES[shade].amount))])
  ) as Record<(typeof BRAND_SHADES)[number], string>;

  return { primaryColor, palette };
}

/**
 * Returns safe CSS generated only from parsed RGB numbers. It is rendered at
 * dashboard-layout level so every surface in the active organization,
 * including fixed overlays, inherits the same identity colors.
 */
export function getBrandThemeCss(value: string | null | undefined): string {
  const { primaryColor, palette } = getBrandPalette(value);
  const primary = hexToRgb(primaryColor);
  const lightPrimary = mix(primary, SHADE_MIXES[400].target, SHADE_MIXES[400].amount);
  const lightAccent = mix(primary, SHADE_MIXES[100].target, SHADE_MIXES[100].amount);
  const lightAccentForeground = mix(primary, SHADE_MIXES[700].target, SHADE_MIXES[700].amount);
  const darkAccent = mix(primary, SHADE_MIXES[900].target, SHADE_MIXES[900].amount);
  const darkAccentForeground = mix(primary, SHADE_MIXES[200].target, SHADE_MIXES[200].amount);
  const brandVariables = BRAND_SHADES.map((shade) => `--brand-${shade}:${palette[shade]}`).join(';');

  return `:root{${brandVariables};--primary:${hslValue(primary)};--ring:${hslValue(primary)};--accent:${hslValue(lightAccent)};--accent-foreground:${hslValue(lightAccentForeground)}}.dark{--primary:${hslValue(lightPrimary)};--ring:${hslValue(lightPrimary)};--accent:${hslValue(darkAccent)};--accent-foreground:${hslValue(darkAccentForeground)}}`;
}
