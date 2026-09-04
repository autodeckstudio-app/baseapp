import { colorSchemes, type ThemeColors } from '@autodeck/design-tokens';

/**
 * Admin defaults to light — a desktop business console, conventionally
 * used in bright offices, and distinct from Studio's dark-first workshop
 * identity. Doc 11.10 calls for "user preference, persisted to account
 * settings" long-term; no preference/persistence mechanism exists yet, so
 * this pass fixes light as the default rather than inventing one.
 */
export function useThemeColors(): ThemeColors {
  return colorSchemes.light;
}
