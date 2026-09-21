export const DEFAULT_PRIMARY_COLOR = "#128C7E";
export const BRAND_COLOR_STORAGE_KEY = "app-brand-primary-color";
export const BRAND_COLOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export type BrandTheme = "light" | "dark";
export type BrandCssVariables = Record<string, string>;

export function isHexColor(value: string | null | undefined): value is string {
  return Boolean(value && HEX_COLOR_PATTERN.test(value));
}

export function normalizeBrandColor(value: string | null | undefined): string {
  return isHexColor(value) ? value : DEFAULT_PRIMARY_COLOR;
}

export function readStoredBrandColor(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(BRAND_COLOR_STORAGE_KEY);
    return isHexColor(stored) ? stored : null;
  } catch {
    return null;
  }
}

function writeBrandColorCookie(primaryColor: string): void {
  if (typeof document === "undefined" || !isHexColor(primaryColor)) return;
  document.cookie = `${BRAND_COLOR_STORAGE_KEY}=${primaryColor};path=/;max-age=${BRAND_COLOR_COOKIE_MAX_AGE};SameSite=Lax`;
}

function clearBrandColorCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${BRAND_COLOR_STORAGE_KEY}=;path=/;max-age=0;SameSite=Lax`;
}

export function persistBrandColor(primaryColor: string): void {
  if (!isHexColor(primaryColor)) return;

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(BRAND_COLOR_STORAGE_KEY, primaryColor);
    } catch {
      // Ignore storage failures (private mode, quota, etc.).
    }
    writeBrandColorCookie(primaryColor);
  }
}

export function clearPersistedBrandColor(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(BRAND_COLOR_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
  clearBrandColorCookie();
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9A-Fa-f]{6})$/.exec(hex.trim());
  if (!match) return null;
  const value = match[1];
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

export function adjustHexBrightness(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const factor = 1 + percent / 100;
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n * factor)));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(clamp(rgb.r))}${toHex(clamp(rgb.g))}${toHex(clamp(rgb.b))}`;
}

export const DEFAULT_PRIMARY_HOVER = adjustHexBrightness(DEFAULT_PRIMARY_COLOR, -12);

export function mixHex(colorA: string, colorB: string, ratioA: number): string {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  if (!a || !b) return colorA;
  const ratioB = 1 - ratioA;
  const mix = (x: number, y: number) => Math.round(x * ratioA + y * ratioB);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(a.r, b.r))}${toHex(mix(a.g, b.g))}${toHex(mix(a.b, b.b))}`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(18, 140, 126, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function resolveCardHeaderCssVariables(
  primaryColor: string,
  theme: BrandTheme
): BrandCssVariables {
  const darkSlab = theme === "dark" ? "#020617" : "#0f172a";
  const midSlab = theme === "dark" ? "#0f172a" : "#1e293b";
  const start = mixHex(primaryColor, midSlab, theme === "dark" ? 0.62 : 0.72);
  const end = mixHex(primaryColor, darkSlab, theme === "dark" ? 0.48 : 0.58);

  return {
    "--card-header-bg": start,
    "--card-header-gradient": `linear-gradient(135deg, ${start} 0%, ${end} 100%)`,
    "--card-header-title": "#f8fafc",
    "--card-header-subtitle": "rgba(255, 255, 255, 0.72)",
    "--card-header-border": hexToRgba(primaryColor, theme === "dark" ? 0.24 : 0.24),
    "--card-header-link": mixHex(primaryColor, "#ffffff", 0.38),
    "--card-header-link-hover": mixHex(primaryColor, "#ffffff", 0.58),
    "--card-header-icon-bg": hexToRgba(primaryColor, theme === "dark" ? 0.18 : 0.18),
    "--card-header-icon-border": hexToRgba(primaryColor, theme === "dark" ? 0.28 : 0.28),
  };
}

function resolveCoreBrandCssVariables(primaryColor: string): BrandCssVariables {
  const hover = adjustHexBrightness(primaryColor, -12);
  const light = hexToRgba(primaryColor, 0.07);

  return {
    "--brand-primary": primaryColor,
    "--brand-primary-hover": hover,
    "--brand-primary-light": light,
    "--topbar": primaryColor,
    "--color-brand-primary": primaryColor,
    "--accent": primaryColor,
    "--accent-hover": hover,
    "--accent-muted": light,
    "--color-accent": primaryColor,
    "--color-accent-hover": hover,
    "--color-accent-muted": light,
  };
}

export function resolveBrandCssVariables(
  primaryColor: string,
  theme: BrandTheme = "light"
): BrandCssVariables {
  return {
    ...resolveCoreBrandCssVariables(primaryColor),
    ...resolveCardHeaderCssVariables(primaryColor, theme),
  };
}

function serializeCssVariables(variables: BrandCssVariables): string {
  return Object.entries(variables)
    .map(([name, value]) => `${name}:${value}`)
    .join(";");
}

export function renderBrandThemeCss(primaryColor: string): string {
  const color = normalizeBrandColor(primaryColor);
  const light = resolveBrandCssVariables(color, "light");
  const darkCardHeaders = resolveCardHeaderCssVariables(color, "dark");

  return `:root{${serializeCssVariables(light)}}[data-theme="dark"]{${serializeCssVariables({
    ...resolveCoreBrandCssVariables(color),
    ...darkCardHeaders,
  })}}`;
}

export function applyCardHeaderCssVariables(
  primaryColor: string,
  theme: BrandTheme = "light"
): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const variables = resolveCardHeaderCssVariables(primaryColor, theme);
  for (const [name, value] of Object.entries(variables)) {
    root.style.setProperty(name, value);
  }
}

export function applyBrandCssVariables(primaryColor: string): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const color = normalizeBrandColor(primaryColor);
  const theme = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const variables = resolveBrandCssVariables(color, theme);

  for (const [name, value] of Object.entries(variables)) {
    root.style.setProperty(name, value);
  }

  persistBrandColor(color);
}
