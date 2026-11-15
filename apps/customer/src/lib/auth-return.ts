/**
 * Web-only return destination for signed-out deep links.
 *
 * A visitor opening an internal URL (e.g. /catalogue?cat=ppf from the
 * website) is bounced to /(auth)/login by the NavigationGuard. Without a
 * remembered destination the guard lands them on plain Home after sign-in
 * and the intent is lost. This module captures the intended path+query
 * before that redirect and hands it back once, after auth completes.
 *
 * Safety: internal absolute paths only (no scheme, no "//host", no
 * backslashes/control chars, never an auth screen), stored in
 * sessionStorage (tab-scoped, gone when the tab closes), consumed
 * one-shot, and discarded after TTL_MS so a stale intent cannot replay
 * into a later unrelated sign-in on the same tab.
 */
const KEY = "autodeck.authReturn.v1";
const TTL_MS = 30 * 60 * 1000;

function store(): Storage | null {
  try {
    const w = (globalThis as { window?: { sessionStorage?: Storage } }).window;
    return w && w.sessionStorage ? w.sessionStorage : null;
  } catch {
    return null;
  }
}

export function isSafeInternalPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("\\") || /[\r\n\t\0]/.test(path)) return false;
  if (path === "/") return false;
  if (/^\/(login|welcome|setup)(\/|\?|#|$)/.test(path)) return false;
  return true;
}

export function captureAuthReturn(path: string | null | undefined, now: number = Date.now()): void {
  const s = store();
  if (!s || !path || !isSafeInternalPath(path)) return;
  try {
    s.setItem(KEY, JSON.stringify({ path, at: now }));
  } catch {
    /* storage full/blocked: intent is best-effort */
  }
}

export function peekAuthReturn(now: number = Date.now()): string | null {
  const s = store();
  if (!s) return null;
  try {
    const raw = s.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { path, at } = parsed as { path?: unknown; at?: unknown };
    if (typeof path !== "string" || typeof at !== "number") return null;
    if (at > now + 60_000 || now - at > TTL_MS) return null;
    return isSafeInternalPath(path) ? path : null;
  } catch {
    return null;
  }
}

/** One-shot: the stored intent is always cleared by calling this. */
export function consumeAuthReturn(now: number = Date.now()): string | null {
  const s = store();
  if (!s) return null;
  const path = peekAuthReturn(now);
  try {
    s.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return path;
}
