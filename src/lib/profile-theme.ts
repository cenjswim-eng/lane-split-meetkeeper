export const DEFAULT_THEME = { primary_color: "#3cc8e0", accent_color: "#f2b33d" };
export const isHexColor = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

/** Dark or light text that stays readable on the given background color. */
export function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.25 ? "oklch(0.17 0.035 240)" : "oklch(0.98 0 0)";
}

export function applyTheme(t: { primary_color: string; accent_color: string } | null) {
  if (typeof document === "undefined") return;
  const s = document.documentElement.style;
  const p = t && isHexColor(t.primary_color) ? t.primary_color : null;
  const a = t && isHexColor(t.accent_color) ? t.accent_color : null;
  for (const [k, v] of [["--primary", p], ["--ring", p], ["--chart-1", p], ["--primary-foreground", p && readableOn(p)], ["--accent", a], ["--chart-2", a], ["--accent-foreground", a && readableOn(a)]] as const) {
    if (v) s.setProperty(k, v); else s.removeProperty(k);
  }
}
