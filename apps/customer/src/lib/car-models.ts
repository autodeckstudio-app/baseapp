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

// Half-width of the body along its length (t = 0 at the nose, 1 at the tail), as a share of `half`.
const PROFILE: Array<[number, number]> = [[0, 0.5], [0.015, 0.66], [0.05, 0.84], [0.1, 0.94], [0.18, 0.985], [0.3, 1], [0.7, 1], [0.86, 0.975], [0.94, 0.92], [0.985, 0.8], [1, 0.62]];
function halfAt(t: number, tailFull: number): number {
  let i = 0;
  while (i < PROFILE.length - 2 && PROFILE[i + 1]![0] < t) i++;
  const [t0, v0] = PROFILE[i]!, [t1, v1] = PROFILE[i + 1]!;
  const u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0))), k = u * u * (3 - 2 * u);
  const v = v0 + (v1 - v0) * k;
  return t > 0.8 ? v + (1 - v) * tailFull * ((t - 0.8) / 0.2) * 0.6 : v;
}

/** SVG markup for the car seen from above. `night` darkens the lighting and lights the headlamps, `hi` marks a zone. */
export function carSvg(shape: BodyShape, colour: string, night: boolean, hi: ZoneKey | null): string {
  const s = SHAPES[shape];
  const { nose, tail, hoodEnd, windTop, roofEnd, rearBase, half } = s;
  const len = tail - nose;
  const tailFull = shape === "suv" || shape === "mpv" || shape === "pickup" ? 1 : shape === "hatch" ? 0.6 : 0;
  const hw = (y: number) => half * halfAt((y - nose) / len, tailFull);
  const lit = night ? mix(colour, "#000000", 0.3) : colour;
  const hiC = mix(lit, "#FFFFFF", 0.42), loC = mix(lit, "#000000", 0.42), deep = mix(lit, "#000000", 0.62);
  const f = (n: number) => n.toFixed(1);
  const ys: number[] = [];
  for (let i = 0; i <= 64; i++) ys.push(nose + (len * i) / 64);
  const right = ys.map((y) => `${f(100 + hw(y))} ${f(y)}`);
  const left = [...ys].reverse().map((y) => `${f(100 - hw(y))} ${f(y)}`);
  const body = `M${right.join(" L")} L${left.join(" L")} Z`;
  const glassTop = night ? "#0B1119" : "#26323F", glassBot = night ? "#020305" : "#0C1218";
  const gW = (y: number) => hw(y) - 15;
  const pano = shape === "sedan";
  const wsTop = hoodEnd + 40;
  const wind = `M${f(100 - gW(hoodEnd))} ${hoodEnd} Q100 ${hoodEnd - 9} ${f(100 + gW(hoodEnd))} ${hoodEnd} L${f(100 + gW(wsTop) - 6)} ${wsTop} Q100 ${wsTop - 6} ${f(100 - gW(wsTop) + 6)} ${wsTop} Z`;
  const roofTop = pano ? wsTop + 2 : windTop, roofBot = pano ? rearBase - 22 : roofEnd;
  const roofPath = `M${f(100 - gW(roofTop) + 7)} ${roofTop} Q100 ${roofTop - 5} ${f(100 + gW(roofTop) - 7)} ${roofTop} L${f(100 + gW(roofBot) - 7)} ${roofBot} Q100 ${roofBot + 5} ${f(100 - gW(roofBot) + 7)} ${roofBot} Z`;
  const rearGlass = shape === "pickup"
    ? `M${f(100 - gW(roofEnd) + 12)} ${roofEnd} L${f(100 + gW(roofEnd) - 12)} ${roofEnd} L${f(100 + gW(rearBase) - 14)} ${rearBase} L${f(100 - gW(rearBase) + 14)} ${rearBase} Z`
    : `M${f(100 - gW(roofBot) + 6)} ${roofBot} Q100 ${roofBot + 5} ${f(100 + gW(roofBot) - 6)} ${roofBot} L${f(100 + gW(rearBase))} ${rearBase} Q100 ${rearBase + 9} ${f(100 - gW(rearBase))} ${rearBase} Z`;
  const front = nose + len * 0.2, rear = nose + len * 0.8;
  const wheel = (side: -1 | 1, y: number) => {
    const x = 100 + side * (hw(y) - 3);
    return `<rect x="${f(side < 0 ? x - 12 : x - 6)}" y="${f(y - 29)}" width="18" height="58" rx="8" fill="#08090B"/><rect x="${f(side < 0 ? x - 6 : x - 3)}" y="${f(y - 24)}" width="9" height="48" rx="4" fill="#22252B"/>`;
  };
  const doorY1 = hoodEnd + 8, doorY3 = roofEnd - 4, doorY2 = (doorY1 + doorY3) / 2 + 6;
  const door = (y: number) => `<path d="M${f(100 - hw(y) + 4)} ${f(y)} Q${f(100 - hw(y) + 12)} ${f(y - 2)} ${f(100 - hw(y) + 22)} ${f(y)} M${f(100 + hw(y) - 4)} ${f(y)} Q${f(100 + hw(y) - 12)} ${f(y - 2)} ${f(100 + hw(y) - 22)} ${f(y)}" stroke="${deep}" stroke-width="1.3" opacity=".75" fill="none"/>`;
  const handle = (y: number) => `<rect x="${f(100 - hw(y) + 5)}" y="${f(y)}" width="12" height="3" rx="1.5" fill="${deep}" opacity=".8"/><rect x="${f(100 + hw(y) - 17)}" y="${f(y)}" width="12" height="3" rx="1.5" fill="${deep}" opacity=".8"/>`;
  const sideGlass = (y0: number, y1: number) => `<path d="M${f(100 - hw(y0) + 5)} ${y0} L${f(100 - hw(y0) + 21)} ${y0 + 2} L${f(100 - hw(y1) + 20)} ${y1} L${f(100 - hw(y1) + 7)} ${y1} Z M${f(100 + hw(y0) - 5)} ${y0} L${f(100 + hw(y0) - 21)} ${y0 + 2} L${f(100 + hw(y1) - 20)} ${y1} L${f(100 + hw(y1) - 7)} ${y1} Z" fill="url(#g)" opacity=".92"/>`;
  const glow = (d: string) => `<path d="${d}" fill="#EC8638" opacity=".34"/><path d="${d}" fill="none" stroke="#EC8638" stroke-width="1.6" opacity=".9"/>`;
  const hoodPath = `M${f(100 - hw(nose + 48) + 8)} ${nose + 48} Q100 ${nose + 40} ${f(100 + hw(nose + 48) - 8)} ${nose + 48} L${f(100 + hw(hoodEnd) - 8)} ${hoodEnd - 3} L${f(100 - hw(hoodEnd) + 8)} ${hoodEnd - 3} Z`;
  const trunkTop = shape === "pickup" ? rearBase : rearBase + 10;
  const trunkPath = `M${f(100 - hw(trunkTop) + 8)} ${trunkTop} L${f(100 + hw(trunkTop) - 8)} ${trunkTop} L${f(100 + hw(tail - 16) - 10)} ${tail - 16} Q100 ${tail - 10} ${f(100 - hw(tail - 16) + 10)} ${tail - 16} Z`;
  const bed = s.bed ? `<path d="${trunkPath}" fill="${deep}"/><path d="${trunkPath}" fill="#000" opacity=".35" transform="translate(100 ${(trunkTop + tail) / 2}) scale(.82 .9) translate(-100 ${-(trunkTop + tail) / 2})"/>` : "";
  const sideZone = (side: -1 | 1) => {
    const y0 = doorY1, y1 = roofEnd, x0 = side < 0 ? 100 - hw(doorY2) : 100 + hw(doorY2) - 30;
    return `<rect x="${f(x0)}" y="${y0}" width="30" height="${y1 - y0}" rx="9" fill="#EC8638" opacity=".34"/>`;
  };
  const beams = night
    ? `<path d="M${f(100 - hw(nose + 22) + 10)} ${nose + 14} L${f(100 - hw(nose) - 22)} 2 L${f(100 - 6)} 2 L${f(100 - 14)} ${nose + 14} Z M${f(100 + hw(nose + 22) - 10)} ${nose + 14} L${f(100 + hw(nose) + 22)} 2 L${f(100 + 6)} 2 L${f(100 + 14)} ${nose + 14} Z" fill="url(#beam)"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${VIEW.w}" height="${VIEW.h}" viewBox="0 0 ${VIEW.w} ${VIEW.h}">
<defs>
<linearGradient id="b" x1="0" x2="1"><stop offset="0" stop-color="${loC}"/><stop offset=".16" stop-color="${lit}"/><stop offset=".36" stop-color="${hiC}"/><stop offset=".5" stop-color="${mix(lit, "#FFFFFF", 0.18)}"/><stop offset=".64" stop-color="${hiC}"/><stop offset=".84" stop-color="${lit}"/><stop offset="1" stop-color="${loC}"/></linearGradient>
<linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${night ? 0.1 : 0.28}"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient>
<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${glassTop}"/><stop offset="1" stop-color="${glassBot}"/></linearGradient>
<linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".42" stop-color="#fff" stop-opacity="${night ? 0.1 : 0.34}"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset=".72" stop-color="#fff" stop-opacity="${night ? 0.05 : 0.16}"/><stop offset=".78" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFF4D6" stop-opacity=".55"/><stop offset="1" stop-color="#FFF4D6" stop-opacity="0"/></linearGradient>
<radialGradient id="s" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset=".7" stop-color="#000" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<filter id="soft"><feGaussianBlur stdDeviation="1.6"/></filter>
<clipPath id="c"><path d="${body}"/></clipPath>
</defs>
<ellipse cx="102" cy="${f((nose + tail) / 2 + 10)}" rx="${half + 30}" ry="${f(len / 2 + 18)}" fill="url(#s)"/>
${beams}
${wheel(-1, front)}${wheel(1, front)}${wheel(-1, rear)}${wheel(1, rear)}
<path d="${body}" fill="url(#b)"/>
<g clip-path="url(#c)">
<path d="${body}" fill="url(#v)"/>
<rect x="0" y="${nose}" width="200" height="${len}" fill="url(#sheen)"/>
<path d="M${f(100 - 24)} ${nose + 30} Q${f(100 - 34)} ${hoodEnd - 40} ${f(100 - 30)} ${hoodEnd - 6} M${f(100 + 24)} ${nose + 30} Q${f(100 + 34)} ${hoodEnd - 40} ${f(100 + 30)} ${hoodEnd - 6}" stroke="#fff" stroke-width="3" opacity="${night ? 0.1 : 0.4}" fill="none" filter="url(#soft)"/>
<path d="M${f(100 - hw(nose + len * 0.5) + 2)} ${hoodEnd} L${f(100 - hw(nose + len * 0.5) + 2)} ${rearBase}" stroke="#000" stroke-width="6" opacity=".16" filter="url(#soft)"/>
<path d="M${f(100 + hw(nose + len * 0.5) - 2)} ${hoodEnd} L${f(100 + hw(nose + len * 0.5) - 2)} ${rearBase}" stroke="#000" stroke-width="6" opacity=".16" filter="url(#soft)"/>
</g>
<path d="${body}" fill="none" stroke="${deep}" stroke-width="1.3" opacity=".7"/>
<path d="${hoodPath}" fill="none" stroke="${deep}" stroke-width="1" opacity=".5"/>
${s.bed ? bed : `<path d="${trunkPath}" fill="none" stroke="${deep}" stroke-width="1" opacity=".5"/>`}
<path d="M${f(100 - 26)} ${nose + 4} Q100 ${nose - 1} ${f(100 + 26)} ${nose + 4} L${f(100 + 24)} ${nose + 12} Q100 ${nose + 8} ${f(100 - 24)} ${nose + 12} Z" fill="${deep}" opacity=".9"/>
<path d="M${f(100 - hw(nose + 24) + 6)} ${nose + 30} Q${f(100 - hw(nose + 24) + 22)} ${nose + 16} ${f(100 - 32)} ${nose + 20} L${f(100 - 30)} ${nose + 27} Q${f(100 - hw(nose + 24) + 20)} ${nose + 30} ${f(100 - hw(nose + 24) + 8)} ${nose + 38} Z M${f(100 + hw(nose + 24) - 6)} ${nose + 30} Q${f(100 + hw(nose + 24) - 22)} ${nose + 16} ${f(100 + 32)} ${nose + 20} L${f(100 + 30)} ${nose + 27} Q${f(100 + hw(nose + 24) - 20)} ${nose + 30} ${f(100 + hw(nose + 24) - 8)} ${nose + 38} Z" fill="${night ? "#FFF6DC" : "#F4F1E8"}" stroke="${deep}" stroke-width=".8"/>
<path d="M${f(100 - hw(tail - 14) + 6)} ${tail - 22} Q100 ${tail - 14} ${f(100 + hw(tail - 14) - 6)} ${tail - 22} L${f(100 + hw(tail - 14) - 8)} ${tail - 13} Q100 ${tail - 6} ${f(100 - hw(tail - 14) + 8)} ${tail - 13} Z" fill="#C8202A" opacity=".92"/>
<path d="${wind}" fill="url(#g)"/>
<path d="${wind}" fill="url(#sheen)" opacity=".8"/>
${pano
  ? `<path d="${roofPath}" fill="url(#g)"/><path d="${roofPath}" fill="url(#sheen)"/><path d="M${f(100 - gW(roofTop) + 12)} ${(roofTop + roofBot) / 2} L${f(100 + gW(roofTop) - 12)} ${(roofTop + roofBot) / 2}" stroke="#fff" stroke-width=".7" opacity=".15"/>`
  : `<path d="${roofPath}" fill="${mix(lit, "#FFFFFF", night ? 0.08 : 0.2)}"/><path d="${roofPath}" fill="url(#sheen)"/><path d="${roofPath}" fill="none" stroke="${deep}" stroke-width=".9" opacity=".5"/>${shape === "suv" || shape === "mpv" ? `<path d="M${f(100 - hw(roofTop) + 12)} ${roofTop + 6} L${f(100 - hw(roofBot) + 12)} ${roofBot - 4} M${f(100 + hw(roofTop) - 12)} ${roofTop + 6} L${f(100 + hw(roofBot) - 12)} ${roofBot - 4}" stroke="#14171B" stroke-width="3" stroke-linecap="round" opacity=".8"/>` : ""}`}
<path d="${rearGlass}" fill="url(#g)"/>
${sideGlass(hoodEnd + 12, doorY2 - 6)}${sideGlass(doorY2 + 2, pano ? rearBase - 18 : roofEnd - 6)}
${door(doorY1)}${door(doorY2)}${door(doorY3)}${handle(doorY1 + 22)}${handle(doorY2 + 20)}
<path d="M${f(100 - hw(hoodEnd + 10))} ${hoodEnd + 6} q-7 -3 -10 4 q1 10 10 9 z M${f(100 + hw(hoodEnd + 10))} ${hoodEnd + 6} q7 -3 10 4 q-1 10 -10 9 z" fill="${lit}" stroke="${deep}" stroke-width="1"/>
${hi === "hood" ? glow(hoodPath) : ""}${hi === "windshield" ? glow(wind) : ""}${hi === "roof" ? glow(roofPath) : ""}${hi === "rear" ? glow(rearGlass) : ""}${hi === "trunk" ? glow(trunkPath) : ""}${hi === "left" ? sideZone(-1) : ""}${hi === "right" ? sideZone(1) : ""}
</svg>`;
}

export const svgUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
