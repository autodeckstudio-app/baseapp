import { useColorScheme } from 'react-native';
import { colorSchemes, type ThemeColors } from '@autodeck/design-tokens';

/**
 * Resolves the active colour scheme from the system setting. Per the
 * approved blueprint, customer-mobile follows the system preference with
 * no manual override yet (that's a Profile-screen feature for a later
 * pass, not assumed here) — `useColorScheme` already returns `'light'` on
 * any platform/host that hasn't opted into dark mode, so this never
 * silently defaults to dark.
 */
export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return colorSchemes[scheme === 'dark' ? 'dark' : 'light'];
}
