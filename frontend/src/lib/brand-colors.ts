export const DEFAULT_PRIMARY_COLOR = "#4f46e5";

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

export function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(79, 70, 229, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function applyBrandCssVariables(primaryColor: string): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", primaryColor);
  root.style.setProperty("--brand-primary-hover", adjustHexBrightness(primaryColor, -10));
  root.style.setProperty("--brand-primary-light", hexToRgba(primaryColor, 0.08));
}
