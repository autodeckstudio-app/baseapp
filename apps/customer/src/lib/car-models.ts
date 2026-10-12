// Self-built top-down car drawings, one per body shape, generated as SVG so the
// colour follows the customer's car and the theme. No third-party artwork.
// Zones come back in percent of the drawing so tap points sit on real panels.
import type { VehicleCategory } from "@autodeck/core";

export type BodyShape = "hatch" | "sedan" | "suv" | "mpv" | "pickup";
export type ZoneKey = "hood" | "windshield" | "roof" | "rear" | "trunk" | "left" | "right";
export const VIEW = { w: 200, h: 480 } as const;

type P = { nose: number; tail: number; hoodEnd: number; windTop: number; roofEnd: number; rearBase: number; half: number; bed?: boolean; label: string };
const SHAPES: Record<BodyShape, P> = {
  hatch:  { nose: 40, tail: 430, hoodEnd: 165, windTop: 212, roofEnd: 300, rearBase: 330, half: 80, label: "Hatchback" },
  sedan:  { nose: 24, tail: 456, hoodEnd: 170, windTop: 216, roofEnd: 296, rearBase: 330, half: 82, label: "Sedan" },
  suv:    { nose: 30, tail: 452, hoodEnd: 160, windTop: 206, roofEnd: 358, rearBase: 384, half: 88, label: "SUV" },
  mpv:    { nose: 36, tail: 456, hoodEnd: 134, windTop: 178, roofEnd: 394, rearBase: 420, half: 88, label: "MPV" },
  pickup: { nose: 24, tail: 470, hoodEnd: 150, windTop: 192, roofEnd: 262, rearBase: 280, half: 90, bed: true, label: "Pickup" },
};

// Make and model words that decide the shape when the category is missing or too broad.
const MODEL_HINTS: Array<[RegExp, BodyShape]> = [
  [/innova|ertiga|carens|xl6|marazzo|triber|rumion|hycross|alphard|vellfire|carnival|kia ev9/i, "mpv"],
  [/hilux|isuzu|d-?max|scorpio n? ?pick|bolero camper|pickup|pick-up/i, "pickup"],
  [/seltos|creta|venue|brezza|nexon|punch|exter|sonet|thar|scorpio|xuv|harrier|safari|fortuner|endeavour|gloster|hector|compass|grand vitara|hyryder|taigun|kushaq|elevate|jimny|fronx|duster|kiger|magnite|tucson|alcazar|land cruiser|defender|q[2-8]\b|x[1-7]\b|glc|gle|macan|cayenne|urus|range rover|evoque|velar/i, "suv"],
  [/swift|baleno|i20|i10|alto|wagonr|celerio|s-?presso|tiago|altroz|glanza|polo|fiesta|figo|santro|eon|kwid|ignis|punto|jazz|brio|up!|a3 sportback|1 series|a-?class/i, "hatch"],
  [/city|verna|dzire|aura|amaze|ciaz|slavia|virtus|rapid|vento|octavia|superb|elantra|civic|accord|camry|tigor|sedan|a[3-8] |c-?class|e-?class|s-?class|[3-7] series|panamera|ghost|phantom/i, "sedan"],
];

export function shapeFor(category: VehicleCategory | string | null | undefined, make?: string | null, model?: string | null): BodyShape {
  const text = `${make ?? ""} ${model ?? ""}`;
  for (const [re, shape] of MODEL_HINTS) if (re.test(text)) return shape;
  switch (category) {
    case "hatchback": return "hatch";
    case "suv": return "suv";
    case "van": return "mpv";
    case "commercial": return "pickup";
    default: return "sedan";
  }
}

const COLOURS: Array<[RegExp, string]> = [
  [/white|pearl|ivory/i, "#E9ECEF"], [/black|onyx|midnight/i, "#1C1E22"], [/grey|gray|graphite|gunmetal|charcoal/i, "#6C727B"],
  [/silver|steel|platinum/i, "#B9BFC7"], [/red|maroon|crimson|burgundy/i, "#B3262E"], [/blue|navy/i, "#2F5B9A"],
  [/green|olive/i, "#3F6B52"], [/brown|bronze|copper|beige|gold|champagne/i, "#9A7B55"], [/orange/i, "#C9733A"], [/yellow/i, "#D9B63B"],
];
export const bodyColour = (name?: string | null): string => COLOURS.find(([re]) => re.test(name ?? ""))?.[1] ?? "#B9BFC7";

function mix(hex: string, to: string, t: number): string {
  const a = hex.replace("#", ""), b = to.replace("#", "");
  const c = (i: number) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0");
  return `#${c(0)}${c(2)}${c(4)}`;
}

export function zonesFor(shape: BodyShape): Record<ZoneKey, [number, number]> {
  const s = SHAPES[shape];
  const pct = (x: number, y: number): [number, number] => [(x / VIEW.w) * 100, (y / VIEW.h) * 100];
  const mid = (a: number, b: number) => (a + b) / 2;
  return {
    hood: pct(100, mid(s.nose + 18, s.hoodEnd)),
    windshield: pct(100, mid(s.hoodEnd, s.windTop)),
    roof: pct(100, mid(s.windTop, s.roofEnd)),
    rear: pct(100, mid(s.roofEnd, s.rearBase)),
    trunk: pct(100, mid(s.rearBase, s.tail - 10)),
    left: pct(100 - s.half * 0.6, mid(s.hoodEnd + 6, s.roofEnd)),
    right: pct(100 + s.half * 0.6, mid(s.hoodEnd + 6, s.roofEnd)),
  };
}
export const shapeLabel = (shape: BodyShape) => SHAPES[shape].label;

/** SVG markup for the car seen from above. `night` darkens the lighting, `hi` marks a zone. */
export function carSvg(shape: BodyShape, colour: string, night: boolean, hi: ZoneKey | null): string {
  const s = SHAPES[shape];
  const { nose, tail, hoodEnd, windTop, roofEnd, rearBase, half } = s;
  const L = 100 - half, R = 100 + half;
  const lit = night ? mix(colour, "#000000", 0.28) : colour;
  const hiC = mix(lit, "#FFFFFF", 0.35), loC = mix(lit, "#000000", 0.34), deep = mix(lit, "#000000", 0.55);
  const glass = night ? "#05070A" : "#1D2229";
  const glassHi = night ? "#1B222C" : "#4A5666";
  const body = `M100 ${nose} C${100 - half * 0.6} ${nose} ${L + 4} ${nose + 14} ${L} ${nose + 70} L${L - 1} ${hoodEnd + 40} L${L + 1} ${rearBase + 20} C${L} ${tail - 40} ${L + 12} ${tail - 6} ${100 - half * 0.5} ${tail} L${100 + half * 0.5} ${tail} C${R - 12} ${tail - 6} ${R} ${tail - 40} ${R - 1} ${rearBase + 20} L${R + 1} ${hoodEnd + 40} L${R} ${nose + 70} C${R - 4} ${nose + 14} ${100 + half * 0.6} ${nose} 100 ${nose} Z`;
  const gx = half - 14; // glass half-width at the base
  const wind = `M${100 - gx} ${hoodEnd} Q100 ${hoodEnd - 8} ${100 + gx} ${hoodEnd} L${100 + gx - 12} ${windTop} Q100 ${windTop - 4} ${100 - gx + 12} ${windTop} Z`;
  const rearGlass = shape === "pickup"
    ? `M${100 - gx + 10} ${roofEnd} L${100 + gx - 10} ${roofEnd} L${100 + gx - 12} ${rearBase} L${100 - gx + 12} ${rearBase} Z`
    : `M${100 - gx + 12} ${roofEnd} Q100 ${roofEnd + 4} ${100 + gx - 12} ${roofEnd} L${100 + gx - 2} ${rearBase} Q100 ${rearBase + 8} ${100 - gx + 2} ${rearBase} Z`;
  const roofPath = `M${100 - gx + 12} ${windTop + 3} Q100 ${windTop - 1} ${100 + gx - 12} ${windTop + 3} L${100 + gx - 12} ${roofEnd - 2} Q100 ${roofEnd + 2} ${100 - gx + 12} ${roofEnd - 2} Z`;
  const front = nose + 88, rear = tail - 84;
  const wheel = (x: number, y: number) => `<rect x="${x}" y="${y - 27}" width="15" height="54" rx="7" fill="#0A0B0D"/>`;
  const door = (y: number) => `<path d="M${L + 3} ${y} L${L + 16} ${y} M${R - 16} ${y} L${R - 3} ${y}" stroke="${deep}" stroke-width="1.4" opacity=".7" fill="none"/>`;
  const doorMid = (hoodEnd + 6 + roofEnd) / 2;
  const zoneGlow = (key: ZoneKey, d: string) => (hi === key ? `<path d="${d}" fill="#EC8638" opacity=".28"/>` : "");
  const hoodPath = `M${L + 10} ${nose + 40} L${R - 10} ${nose + 40} L${R - 6} ${hoodEnd - 2} L${L + 6} ${hoodEnd - 2} Z`;
  const trunkPath = `M${L + 8} ${rearBase + 6} L${R - 8} ${rearBase + 6} L${R - 14} ${tail - 14} L${L + 14} ${tail - 14} Z`;
  const bed = s.bed ? `<rect x="${L + 12}" y="${rearBase + 4}" width="${half * 2 - 24}" height="${tail - rearBase - 20}" rx="10" fill="${deep}"/><rect x="${L + 20}" y="${rearBase + 14}" width="${half * 2 - 40}" height="${tail - rearBase - 40}" rx="6" fill="${mix(deep, "#000000", 0.3)}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${VIEW.w}" height="${VIEW.h}" viewBox="0 0 ${VIEW.w} ${VIEW.h}">
<defs>
<linearGradient id="b" x1="0" x2="1"><stop offset="0" stop-color="${loC}"/><stop offset=".3" stop-color="${hiC}"/><stop offset=".55" stop-color="${lit}"/><stop offset=".78" stop-color="${hiC}"/><stop offset="1" stop-color="${loC}"/></linearGradient>
<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${glassHi}"/><stop offset="1" stop-color="${glass}"/></linearGradient>
<radialGradient id="s" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".38"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
</defs>
<ellipse cx="100" cy="${(nose + tail) / 2 + 8}" rx="${half + 24}" ry="${(tail - nose) / 2 + 14}" fill="url(#s)"/>
${wheel(L - 8, front)}${wheel(R - 7, front)}${wheel(L - 8, rear)}${wheel(R - 7, rear)}
<path d="${body}" fill="url(#b)"/>
<path d="${body}" fill="none" stroke="${deep}" stroke-width="1.2" opacity=".55"/>
${s.bed ? bed : `<path d="${trunkPath}" fill="none" stroke="${deep}" stroke-width="1.1" opacity=".5"/>`}
<path d="${hoodPath}" fill="none" stroke="${deep}" stroke-width="1.1" opacity=".5"/>
<path d="M${100 - 22} ${nose + 44} L${100 - 30} ${hoodEnd - 6} M${100 + 22} ${nose + 44} L${100 + 30} ${hoodEnd - 6}" stroke="${hiC}" stroke-width="2" opacity=".55" fill="none"/>
<rect x="${100 - 22}" y="${nose + 2}" width="44" height="10" rx="5" fill="${deep}" opacity=".85"/>
<path d="M${L + 8} ${nose + 22} q10 -8 26 -4 l-2 10 q-14 0 -24 6 z M${R - 8} ${nose + 22} q-10 -8 -26 -4 l2 10 q14 0 24 6 z" fill="#F6F2E8" opacity=".9"/>
<path d="M${L + 10} ${tail - 8} q10 -10 26 -8 l-1 8 z M${R - 10} ${tail - 8} q-10 -10 -26 -8 l1 8 z" fill="#C42A2A" opacity=".9"/>
<path d="${wind}" fill="url(#g)"/>
<path d="${roofPath}" fill="${mix(lit, "#FFFFFF", night ? 0.06 : 0.22)}"/>
<path d="${roofPath}" fill="none" stroke="${deep}" stroke-width="1" opacity=".45"/>
<path d="${rearGlass}" fill="url(#g)"/>
<path d="M${L + 5} ${windTop + 4} L${L + 17} ${windTop + 4} L${L + 17} ${roofEnd - 4} L${L + 8} ${roofEnd - 4} Z M${R - 5} ${windTop + 4} L${R - 17} ${windTop + 4} L${R - 17} ${roofEnd - 4} L${R - 8} ${roofEnd - 4} Z" fill="${glass}" opacity=".78"/>
${door(hoodEnd + 6)}${door(doorMid)}${door(roofEnd)}
<ellipse cx="${L - 7}" cy="${hoodEnd + 12}" rx="9" ry="6" fill="${lit}" stroke="${deep}" stroke-width="1"/><ellipse cx="${R + 7}" cy="${hoodEnd + 12}" rx="9" ry="6" fill="${lit}" stroke="${deep}" stroke-width="1"/>
${zoneGlow("hood", hoodPath)}${zoneGlow("windshield", wind)}${zoneGlow("roof", roofPath)}${zoneGlow("rear", rearGlass)}${zoneGlow("trunk", trunkPath)}
${hi === "left" ? `<rect x="${L}" y="${hoodEnd + 6}" width="26" height="${roofEnd - hoodEnd - 6}" rx="8" fill="#EC8638" opacity=".28"/>` : ""}${hi === "right" ? `<rect x="${R - 26}" y="${hoodEnd + 6}" width="26" height="${roofEnd - hoodEnd - 6}" rx="8" fill="#EC8638" opacity=".28"/>` : ""}
</svg>`;
}

export const svgUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
