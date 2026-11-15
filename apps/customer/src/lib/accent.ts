// One rule for orange (#EC8638), applied by tokens, not per page (owner pick 18 Oct 2026, 60-30-10).
// Orange is for: the active navigation item, small kickers and captions, the unread dot, one small highlight.
// Orange is NOT for: prices, big text, avatars, progress bars. Those stay neutral. Main buttons stay white or ink.
/** Text roles allowed to be orange. Anything bigger renders neutral even if a call site asks for the accent tone. */
export const ACCENT_TEXT_ROLES: readonly string[] = ["label", "caption"];

/** Fill for a progress bar or a done step: neutral, never orange. */
export function progressFill(colors: { textPrimary: string }): string {
  return colors.textPrimary;
}
