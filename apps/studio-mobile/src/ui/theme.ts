import { colorSchemes, type ThemeColors } from '@autodeck/design-tokens';

/**
 * Studio is dark-first BY DEFAULT, per the approved design-system
 * direction (doc 11.10): "Studio app: dark mode as default (workshop
 * environments, task lighting, evening operations)." Unlike customer-
 * mobile (which follows the OS setting), there is no light/dark toggle in
 * this pass — always dark. This is a UI default, not an RBAC or backend
 * change.
 */
export function useThemeColors(): ThemeColors {
  return colorSchemes.dark;
}
