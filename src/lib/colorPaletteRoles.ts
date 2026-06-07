type Rgb = { r: number; g: number; b: number };

type ColorStats = {
  hex: string;
  hue: number;
  saturation: number;
  lightness: number;
  chroma: number;
  luminance: number;
  neutral: boolean;
};

export type PaletteRoleInput = {
  primary?: unknown;
  accent?: unknown;
  secondary?: unknown;
  palette?: unknown;
};

export type PaletteRoleResult = {
  primary: string;
  accent: string;
  secondary: string;
  orderedPalette: string[];
  colorfulColors: string[];
  neutralColors: string[];
};

function hexToRgb(hex: string): Rgb | null {
  const normalized = hex.trim().replace("#", "");
  const expanded = normalized.length === 3 ? normalized.split("").map((char) => char + char).join("") : normalized;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return null;
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;
}

function normalizeHex(value: unknown) {
  if (typeof value !== "string") return "";
  const rgb = hexToRgb(value);
  return rgb ? rgbToHex(rgb.r, rgb.g, rgb.b).toUpperCase() : "";
}

function relativeLuminance(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function rgbToHsl({ r, g, b }: Rgb) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;
  if (delta > 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { hue, saturation, lightness, chroma: delta };
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs((normalizedHue / 60) % 2 - 1));
  const m = lightness - c / 2;
  const [r1, g1, b1] = normalizedHue < 60 ? [c, x, 0]
    : normalizedHue < 120 ? [x, c, 0]
      : normalizedHue < 180 ? [0, c, x]
        : normalizedHue < 240 ? [0, x, c]
          : normalizedHue < 300 ? [x, 0, c]
            : [c, 0, x];
  return rgbToHex((r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255).toUpperCase();
}

function statsFor(hex: string): ColorStats | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const hsl = rgbToHsl(rgb);
  const luminance = relativeLuminance(hex);
  return {
    hex: normalizeHex(hex),
    ...hsl,
    luminance,
    neutral: hsl.saturation < 0.18 || hsl.chroma < 0.09,
  };
}

function hueDistance(a: number, b: number) {
  const diff = Math.abs(a - b) % 360;
  return Math.min(diff, 360 - diff);
}

function uniqueColors(values: unknown[]) {
  const seen = new Set<string>();
  const colors: string[] = [];
  values.forEach((value) => {
    const hex = normalizeHex(value);
    if (!hex || seen.has(hex)) return;
    seen.add(hex);
    colors.push(hex);
  });
  return colors;
}

function primaryScore(color: ColorStats) {
  const usefulDepth = 1 - Math.abs(color.luminance - 0.22);
  const notWashed = color.lightness > 0.08 && color.lightness < 0.82 ? 0.5 : -0.8;
  return color.saturation * 1.6 + color.chroma * 1.2 + usefulDepth * 0.7 + notWashed - (color.neutral ? 2.2 : 0);
}

function accentScore(color: ColorStats, primary: ColorStats | null) {
  const hueBonus = primary ? Math.min(hueDistance(color.hue, primary.hue) / 120, 1) * 0.6 : 0;
  const usefulLightness = color.lightness > 0.12 && color.lightness < 0.86 ? 0.35 : -0.5;
  return color.saturation * 1.5 + color.chroma + hueBonus + usefulLightness - (color.neutral ? 2 : 0);
}

function synthesizeAccent(primary: ColorStats | null) {
  if (!primary || primary.neutral) return "#4F46E5";
  const hueOffset = primary.hue >= 20 && primary.hue <= 70 ? 155 : 34;
  return hslToHex(primary.hue + hueOffset, Math.max(0.55, primary.saturation), Math.min(0.48, Math.max(0.34, primary.lightness)));
}

export function normalizePaletteRoles(input: PaletteRoleInput): PaletteRoleResult {
  const palette = Array.isArray(input.palette) ? input.palette : [];
  const colors = uniqueColors([input.primary, input.accent, input.secondary, ...palette]);
  const fallback = ["#111827", "#4F46E5", "#F3F4F6"];
  const stats = (colors.length ? colors : fallback).map(statsFor).filter(Boolean) as ColorStats[];
  const colorful = stats.filter((color) => !color.neutral && color.lightness > 0.06 && color.lightness < 0.9);
  const neutral = stats.filter((color) => color.neutral);
  const isPrimarySuitable = (color: ColorStats) => color.luminance > 0.08 && color.luminance < 0.55;
  const primaryStats = [...colorful].sort((a, b) => primaryScore(b) - primaryScore(a))[0]
    || [...stats].sort((a, b) => (isPrimarySuitable(b) ? 1 : 0) - (isPrimarySuitable(a) ? 1 : 0) || b.chroma - a.chroma)[0]
    || statsFor(fallback[0])!;
  const accentStats = [...colorful]
    .filter((color) => color.hex !== primaryStats.hex && hueDistance(color.hue, primaryStats.hue) >= 16)
    .sort((a, b) => accentScore(b, primaryStats) - accentScore(a, primaryStats))[0];
  const accent = accentStats?.hex || synthesizeAccent(primaryStats);
  const secondary = [...neutral].sort((a, b) => Math.abs(a.luminance - 0.86) - Math.abs(b.luminance - 0.86))[0]?.hex
    || normalizeHex(input.secondary)
    || "#F3F4F6";
  const orderedPalette = uniqueColors([
    primaryStats.hex,
    accent,
    secondary,
    ...stats.map((color) => color.hex),
  ]);
  return {
    primary: primaryStats.hex,
    accent,
    secondary,
    orderedPalette,
    colorfulColors: colorful.map((color) => color.hex),
    neutralColors: neutral.map((color) => color.hex),
  };
}
