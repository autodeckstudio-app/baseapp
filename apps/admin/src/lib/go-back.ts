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

export function goBackOrTo(router: { back: () => void; push: (href: string) => void }, fallback: string, store: Store | null = tabStore()): void {
  const views = store ? Number(store.getItem(KEY)) || 0 : 0;
  if (views > 1) router.back();
  else router.push(fallback);
}
