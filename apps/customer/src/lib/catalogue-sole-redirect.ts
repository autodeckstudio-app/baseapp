/**
 * A category listing with exactly one service has nothing to choose from, so the
 * catalogue index redirects straight to that service's detail page.
 *
 * The index screen stays MOUNTED while it sits underneath pushed pages in the tab
 * stack, and its service list resolves asynchronously. Without a focus gate, the
 * redirect can fire a second or two after the customer has already left the screen
 * and hijack whatever page is now visible (observed live: Back landing correctly on
 * the Ceramic wash detail, then drifting to an unrelated Maintenance Coat detail
 * once the stale screen underneath finished loading). Redirect only while this
 * screen is focused.
 */
export function soleServiceRedirect(opts: {
  focused: boolean;
  searching: boolean;
  fromRoute: string | undefined;
  catGroup: string | undefined;
  soleLeaf: string | undefined;
}): string | undefined {
  if (!opts.focused || opts.searching || !opts.fromRoute || !opts.catGroup || !opts.soleLeaf) return undefined;
  return opts.soleLeaf;
}
