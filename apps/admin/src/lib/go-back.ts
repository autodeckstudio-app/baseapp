/**
 * Back goes to where the person came from. Only when this tab has not moved between admin pages yet
 * (a pasted or opened link) does it go to the list instead of leaving the app.
 * history.length cannot tell: a fresh tab already has 2 entries (the new-tab page and the link).
 * So the admin layout counts page changes in this tab (sessionStorage) and Back uses that count.
 */
const KEY = "ax-page-views";

type Store = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void };
const tabStore = (): Store | null => { try { return typeof window === "undefined" ? null : window.sessionStorage; } catch { return null; } };

/** Call once per page change inside the admin shell. */
export function notePageView(store: Store | null = tabStore()): void {
  if (!store) return;
  store.setItem(KEY, String((Number(store.getItem(KEY)) || 0) + 1));
}

const RETURNING = "ax-returning";
/**
 * Back from a detail page arms a one-use mark. A list restores its saved view only when the mark is armed
 * and a view was saved by opening a record (list-view-state.ts); the list then clears both. The mark is read
 * when the list mounts, with no page-count timing involved.
 */
export function wasReturning(store: Store | null = tabStore()): boolean { return !!store && store.getItem(RETURNING) === "1"; }
export function clearReturning(store: Store | null = tabStore()): void { if (store) store.setItem(RETURNING, ""); }

export function goBackOrTo(router: { back: () => void; push: (href: string) => void }, fallback: string, store: Store | null = tabStore()): void {
  if (store) store.setItem(RETURNING, "1");
  const views = store ? Number(store.getItem(KEY)) || 0 : 0;
  if (views > 1) router.back();
  else router.push(fallback);
}

/**
 * A redirect (router.replace) changes the path but adds no history entry. It must not count as a page the
 * person moved to, or a link opened cold counts as two pages and Back leaves the app. Take one off first;
 * the layout then counts the redirected page once.
 */
export function replaceWithoutCounting(router: { replace: (href: string) => void }, href: string, store: Store | null = tabStore()): void {
  if (store) store.setItem(KEY, String(Math.max(0, (Number(store.getItem(KEY)) || 0) - 1)));
  router.replace(href);
}
