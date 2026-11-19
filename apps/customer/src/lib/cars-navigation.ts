type EntryState = { index: number; routes: ReadonlyArray<{ key: string; name: string }> };
/** A hub is a fresh entry. A direct Home shortcut is a fresh detail/form entry.
 * Internal hub -> detail/form navigation keeps its stack so Back restores the hub.
 * Preserve the full live route objects (including params) during RESET.
 */
export function freshCarsEntry(state: EntryState | undefined, page: string, origin: unknown) {
  if (page !== 'index' && origin !== 'home') return null;
  if (!state || state.routes.length < 2 || state.index !== state.routes.length - 1) return null;
  const top = state.routes[state.index];
  if (!top || top.name !== page) return null;
  return { index: 0 as const, routes: [top] };
}
