/**
 * AutoDeck design tokens.
 *
 * `colorTokens` and `typeScale` below are the ORIGINAL flat placeholder
 * shapes from Phase 0 and are kept byte-for-byte unchanged — studio-mobile
 * still consumes them directly (`colorTokens.background`, `typeScale.body`
 * as a raw fontSize) and this pass is scoped to customer-mobile only, per
 * the approved design-gate review. Breaking studio-mobile's build to
 * reshape a shared package would violate that scope boundary, so the richer
 * shapes customer-mobile actually uses are added below as NEW, additional
 * exports (`colorSchemes`, `typeRamps`, `radiusScale`, `shadowScale`,
 * `motionScale`, `touchTarget`) rather than by changing what already exists.
 *
 * WORKING VALUES, NOT A FINAL BRAND DECISION. Per the approved design-gate
 * review, `colorSchemes` below implements the directional recommendation
 * (near-black/warm charcoal base, a single restrained graphite/mineral
 * accent) as centralized tokens so the eventual real brand values are a
 * one-file swap, never a per-screen hunt. Do not read any hex value here
 * as final.
 */

export const colorTokens = {
  background: '#FFFFFF',
  surface: '#F5F5F5',
  border: '#E0E0E0',
  textPrimary: '#111111',
  textSecondary: '#555555',
  accent: '#2D6CDF', // placeholder — no brand color has been decided
  success: '#2E7D32',
  warning: '#ED6C02',
  danger: '#C62828',
} as const;

/**
 * New: explicit light/dark colour pairs (never inverted automatically),
 * per the researched Expo design-system principle. `customer-mobile`'s
 * `ThemedText`/theme hook consumes this; `colorTokens` above is untouched
 * for studio-mobile.
 */
export const colorSchemes = {
  light: {
    background: '#F7F6F3', // warm off-white — never pure white (clinical)
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    border: '#E3E0DA',
    textPrimary: '#14161A',
    textSecondary: '#5B5F66',
    accent: '#4C6B8A', // WORKING — restrained graphite/mineral, not final brand colour
    accentContrast: '#FFFFFF',
    success: '#2E7D32',
    warning: '#B45309',
    danger: '#C62828',
    info: '#5B7A99',
  },
  dark: {
    background: '#0E0F11', // near-black, never pure #000 (too harsh)
    surface: '#17191D',
    surfaceElevated: '#1F2227',
    border: '#2A2D33',
    textPrimary: '#F5F5F4',
    textSecondary: '#A0A4AC',
    accent: '#7B9BBD', // lightened for AA contrast on a dark surface
    accentContrast: '#0E0F11',
    success: '#5CB85F',
    warning: '#D9822B',
    danger: '#E57373',
    info: '#8CA8C4',
  },
} as const;

export type ColorScheme = keyof typeof colorSchemes;
export type ThemeColors = (typeof colorSchemes)[ColorScheme];

/**
 * Fixed dark palette for photography/hero surfaces — deliberately NOT
 * derived from `colorSchemes`. A photograph doesn't re-theme when the
 * viewer's OS switches to light mode, and neither should the "photography"
 * standing in for one; premium automotive brands (Tesla, Porsche) keep
 * image-backed hero bands dark regardless of the surrounding app theme.
 * This is the fix for the light-mode gap identified in the visual audit —
 * only hero/photo bands use this; the rest of the app still follows
 * `colorSchemes` per the approved "dark mode follows system" rule.
 */
export const heroColors = {
  base: '#0B0C0E',
  panelA: '#1A1D22', // simulated reflective surface — layer 1
  panelB: '#242832', // simulated reflective surface — layer 2 (cooler highlight)
  scrim: '#000000', // stacked at increasing opacity for the bottom-up readability scrim
  textPrimary: '#F5F5F4',
  textSecondary: 'rgba(245, 245, 244, 0.72)',
  accent: '#7B9BBD',
  accentContrast: '#0B0C0E',
} as const;

/** Opacity stops for the bottom-up scrim over a hero surface (index 0 = top, last = bottom). */
export const heroScrimStops = [0, 0.05, 0.22, 0.48, 0.72] as const;

/** Base spacing unit system — already correct per the design-gate review, unchanged. */
export const spacingScale = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const typeScale = {
  caption: 12,
  body: 16,
  subtitle: 18,
  title: 24,
  headline: 32,
} as const;

/**
 * New: named type ramp (size + line-height + weight together), not raw
 * font sizes — customer-mobile's `ThemedText` is the only place that reads
 * this, so screens never pass a raw fontSize. `typeScale` above is
 * untouched for studio-mobile.
 *
 * `fontFamily` is intentionally the platform system font for now: Inter is
 * the approved working typography direction, but loading a real Inter
 * asset requires a new dependency (e.g. @expo-google-fonts/inter) that has
 * not been installed. Swapping this one token, once that dependency is
 * added, is the entire migration — no screen references a font family
 * directly.
 */
export const fontFamily = {
  default: undefined, // undefined = platform system font (San Francisco / Roboto)
} as const;

export const typeRamps = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '600' as const },
  heading: { fontSize: 22, lineHeight: 28, fontWeight: '600' as const },
  subheading: { fontSize: 17, lineHeight: 22, fontWeight: '500' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
} as const;

export type TypeRampLevel = keyof typeof typeRamps;

/** Radius steps — paired with `borderCurve: 'continuous'` at the primitive level (iOS squircle). */
export const radiusScale = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const;

/**
 * Elevation levels expressed as concrete React Native shadow style objects
 * (not CSS `boxShadow` strings — RN 0.74 does not yet expose a unified
 * `boxShadow` style prop; `shadow*`/`elevation` is the portable choice that
 * react-native-web still translates to a real CSS box-shadow on web).
 * Kept to three levels, per the researched Expo design-system guidance.
 */
export const shadowScale = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  raised: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  overlay: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;

/**
 * Motion durations (ms) — canonical fast/base/slow naming from the
 * researched Expo design-system guidance. Every animation in the app must
 * reference one of these, never a bespoke duration.
 */
export const motionScale = {
  fast: 150,
  base: 250,
  slow: 400,
} as const;

export const motionEasing = {
  standard: 'ease-out',
} as const;

/** Apple HIG / WCAG minimum interactive-element size, in points. */
export const touchTarget = {
  minimum: 44,
} as const;

export type SpacingScale = typeof spacingScale;
export type TypeScale = typeof typeScale;
export type RadiusScale = typeof radiusScale;
export type ShadowScale = typeof shadowScale;
export type MotionScale = typeof motionScale;
