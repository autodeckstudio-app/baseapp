// WCAG 2.x contrast, for token tests and runtime guards. Handles #RRGGBB
// and rgba() over an opaque background.

type RGB = [number, number, number];

function parseColor(c: string): { rgb: RGB; alpha: number } {
  const hex = /^#([0-9a-f]{6})$/i.exec(c.trim());
  if (hex?.[1]) {
    const n = parseInt(hex[1], 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: 1 };
  }
  const rgba = /^rgba?\(([^)]+)\)$/i.exec(c.trim());
  if (rgba?.[1]) {
    const parts = rgba[1].split(",").map((p) => parseFloat(p.trim()));
    return { rgb: [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0], alpha: parts[3] ?? 1 };
  }
  throw new Error(`Unsupported colour: ${c}`);
}

function over(fg: string, bg: string): RGB {
  const f = parseColor(fg);
  const b = parseColor(bg).rgb;
  const mix = (x: number, y: number) => x * f.alpha + y * (1 - f.alpha);
  return [mix(f.rgb[0], b[0]), mix(f.rgb[1], b[1]), mix(f.rgb[2], b[2])];
}

function luminance([r, g, b]: RGB): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrastRatio(fg: string, bg: string): number {
  const a = luminance(over(fg, bg));
  const b = luminance(parseColor(bg).rgb);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}
