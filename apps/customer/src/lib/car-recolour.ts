// Repaint the body texture of a stylised car model. The atlas holds one flat paint
// colour plus lights, trim and glass, so we find the dominant saturated hue and move
// only the pixels near it to the customer's colour. Lights and trim stay as they are.
type Px = Uint8ClampedArray;

function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  const f = (n: number) => { const k = (n + h / 30) % 12; const a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return [f(0), f(8), f(4)];
}
const hueDist = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

export function paintHue(d: Px): { h: number; l: number } | null {
  const bins = new Array<number>(36).fill(0), lum = new Array<number>(36).fill(0);
  for (let i = 0; i < d.length; i += 16) {
    const [h, s, l] = rgb2hsl(d[i]!, d[i + 1]!, d[i + 2]!);
    if (s > 0.3 && l > 0.25 && l < 0.85 && d[i + 3]! > 200) { const b = Math.floor(h / 10) % 36; bins[b]!++; lum[b]! += l; }
  }
  let best = 0;
  for (let i = 1; i < 36; i++) if (bins[i]! > bins[best]!) best = i;
  if (bins[best]! < 50) return null;
  return { h: best * 10 + 5, l: lum[best]! / bins[best]! };
}

export function recolour(d: Px, target: string): void {
  const p = paintHue(d);
  if (!p) return;
  const [th, ts, tl] = rgb2hsl(parseInt(target.slice(1, 3), 16), parseInt(target.slice(3, 5), 16), parseInt(target.slice(5, 7), 16));
  for (let i = 0; i < d.length; i += 4) {
    const [h, s, l] = rgb2hsl(d[i]!, d[i + 1]!, d[i + 2]!);
    if (s < 0.2 || hueDist(h, p.h) > 24) continue;
    const rel = Math.max(0.6, Math.min(1.25, l / p.l));
    const [r, g, b] = hsl2rgb(th, Math.min(1, ts * (0.6 + s * 0.6)), Math.max(0.04, Math.min(0.96, tl * rel)));
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
}
