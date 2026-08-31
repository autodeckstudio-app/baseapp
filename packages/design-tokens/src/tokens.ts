/**
 * AutoDeck design tokens.
 *
 * PLACEHOLDER VALUES. No AutoDeck brand palette, spacing scale, or type
 * scale has been decided in any approved design document — these are
 * neutral, structurally-reasonable placeholders only, explicitly NOT a
 * brand decision. They exist so the token *shape* (what a color/spacing/
 * type-scale system looks like) is established now, without inventing
 * AutoDeck's actual visual identity ahead of a real design decision.
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

export type ColorTokens = typeof colorTokens;
export type SpacingScale = typeof spacingScale;
export type TypeScale = typeof typeScale;
