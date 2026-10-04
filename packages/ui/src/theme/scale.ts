// Spacing, layout, radius, elevation, type roles and motion
// (spec §3.2-3.5). Pure values; platforms map them.

export const space = {
  unit: 4,
  hair: 4,
  breath: 8,
  line: 12,
  gap: 16,
  inset: 24,
  section: 48,
  scene: 96,
} as const;

export const layout = {
  screenInset: 24,
  screenInsetCompact: 16, // below 360px
  readingMeasure: 600,
  minimumHitArea: 44,
  tabBarHeight: 49,
  breakpoints: { compact: 320, tablet: 768, wide: 1280 },
  sidebarWidth: 248,
} as const;

export const radius = {
  chip: 12,
  card: 16,
  pane: 20,
  sheet: 24,
  hero: 32,
  pill: 9999,
} as const;

// Depth bands. One raised layer per screen; takeover/alert only for real
// modal states.
export const depth = {
  base: { z: 0, shadow: "none", elevation: 0 },
  raised: { z: 1, shadow: "0 18px 40px -20px rgba(0,0,0,0.9)", elevation: 4 },
  float: { z: 10, shadow: "0 24px 50px -24px rgba(0,0,0,0.95)", elevation: 8 },
  nav: { z: 20, shadow: "0 1px 0 rgba(255,255,255,0.06)", elevation: 12 },
  sheet: { z: 30, shadow: "0 60px 120px -40px rgba(0,0,0,0.95)", elevation: 16 },
  takeover: { z: 40, shadow: "0 60px 120px -40px rgba(0,0,0,0.95)", elevation: 20 },
  alert: { z: 50, shadow: "0 60px 120px -40px rgba(0,0,0,0.95)", elevation: 24 },
} as const;

// Font families are OFL (Google Fonts): Montserrat (headings, matches the logo wordmark),
// Inter (body, UI and tabular numbers). Gujarati and Hindi fall back to Noto Sans. Web loads them via next/font; native bundles them
// with expo-font. Fallbacks keep roles meaningful if a face fails.
export const fontFamily = {
  display: "Montserrat",
  body: "Inter",
  data: "Inter",
} as const;

export interface TypeRole {
  family: keyof typeof fontFamily;
  size: number;
  lineHeight: number;
  weight: "200" | "300" | "400" | "500" | "600";
  letterSpacing: number;
  /** Tabular figures (prices, dates, registrations). */
  tabular?: boolean;
  uppercase?: boolean;
}

export const type = {
  display: { family: "display", size: 32, lineHeight: 38, weight: "600", letterSpacing: -0.5 },
  title: { family: "display", size: 24, lineHeight: 30, weight: "600", letterSpacing: -0.3 },
  heading: { family: "display", size: 18, lineHeight: 24, weight: "600", letterSpacing: -0.2 },
  body: { family: "body", size: 15, lineHeight: 22, weight: "400", letterSpacing: 0 },
  bodyStrong: { family: "body", size: 15, lineHeight: 22, weight: "500", letterSpacing: 0 },
  data: { family: "data", size: 14, lineHeight: 20, weight: "500", letterSpacing: 0, tabular: true },
  label: { family: "body", size: 12, lineHeight: 16, weight: "600", letterSpacing: 1.4, uppercase: true },
  // Never below 12px: accessible minimum.
  caption: { family: "body", size: 12, lineHeight: 16, weight: "400", letterSpacing: 0.1 },
} as const satisfies Record<string, TypeRole>;

export const motion = {
  duration: { tick: 120, move: 280, scene: 480, morph: 620 },
  easing: {
    ease: [0.22, 1, 0.36, 1] as const,
    exit: [0.4, 0, 1, 1] as const,
  },
  spring: { stiffness: 420, damping: 38, mass: 1 },
  heroSettle: { scale: 1.06, durationMs: 480 },
  livePulseMs: 2600,
  // Reduced motion is a contract: transforms off, opacity allowed, 0ms.
  reduced: { disableTransforms: true, allowOpacity: true, duration: 0 },
} as const;

export function cubicBezier(e: readonly [number, number, number, number]): string {
  return `cubic-bezier(${e.join(", ")})`;
}
