export const DEFAULT_PRIMARY_COLOR = "#128C7E";

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

export function applyCardHeaderCssVariables(
  primaryColor: string,
  theme: "light" | "dark" = "light"
): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const darkSlab = theme === "dark" ? "#020617" : "#0f172a";
  const midSlab = theme === "dark" ? "#0f172a" : "#1e293b";
  const start = mixHex(primaryColor, midSlab, theme === "dark" ? 0.62 : 0.72);
  const end = mixHex(primaryColor, darkSlab, theme === "dark" ? 0.48 : 0.58);

  root.style.setProperty("--card-header-bg", start);
  root.style.setProperty(
    "--card-header-gradient",
    `linear-gradient(135deg, ${start} 0%, ${end} 100%)`
  );
  root.style.setProperty("--card-header-title", "#f8fafc");
  root.style.setProperty("--card-header-subtitle", "rgba(255, 255, 255, 0.72)");
  root.style.setProperty("--card-header-border", hexToRgba(primaryColor, 0.24));
  root.style.setProperty("--card-header-link", mixHex(primaryColor, "#ffffff", 0.38));
  root.style.setProperty(
    "--card-header-link-hover",
    mixHex(primaryColor, "#ffffff", 0.58)
  );
  root.style.setProperty(
    "--card-header-icon-bg",
    hexToRgba(primaryColor, 0.18)
  );
  root.style.setProperty(
    "--card-header-icon-border",
    hexToRgba(primaryColor, 0.28)
  );
}

export function applyBrandCssVariables(primaryColor: string): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const hover = adjustHexBrightness(primaryColor, -12);
  const light = hexToRgba(primaryColor, 0.07);
  const theme =
    root.getAttribute("data-theme") === "dark" ? "dark" : "light";

  root.style.setProperty("--brand-primary", primaryColor);
  root.style.setProperty("--brand-primary-hover", hover);
  root.style.setProperty("--brand-primary-light", light);
  root.style.setProperty("--topbar", primaryColor);
  root.style.setProperty("--color-brand-primary", primaryColor);
  root.style.setProperty("--accent", primaryColor);
  root.style.setProperty("--accent-hover", hover);
  root.style.setProperty("--accent-muted", light);
  root.style.setProperty("--color-accent", primaryColor);
  root.style.setProperty("--color-accent-hover", hover);
  root.style.setProperty("--color-accent-muted", light);
  applyCardHeaderCssVariables(primaryColor, theme);
}
