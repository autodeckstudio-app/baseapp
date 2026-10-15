// Device-only tidy-up for the notifications list. The server keeps every notification; this only decides what this device shows.
// Rules: read items older than 30 days drop out by themselves; "Clear" and "Dismiss" hide an item on this device;
// Approval requests are never hidden, so a pending approval cannot be cleared away.
const KEY = "autodeck.notifications.hidden.v1";
export const TIDY_AFTER_DAYS = 30;

type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void };
const store = (): Store | null => {
  try { return (globalThis as unknown as { localStorage?: Store }).localStorage ?? null; } catch { return null; }
};

export function loadHidden(): Set<string> {
  try {
    const raw = store()?.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}

export function saveHidden(ids: Set<string>): void {
  try { store()?.setItem(KEY, JSON.stringify([...ids].slice(-500))); } catch { /* storage blocked */ }
}

type N = { id: string; entityType?: string | null; readAt: string | null; createdAt: string };

export const isProtected = (n: N): boolean => n.entityType === "Approval";

export function visibleNotifications<T extends N>(all: T[], hidden: Set<string>, now = Date.now()): T[] {
  const cutoff = now - TIDY_AFTER_DAYS * 86_400_000;
  return all.filter((n) => {
    if (isProtected(n)) return true;
    if (hidden.has(n.id)) return false;
    if (n.readAt !== null && new Date(n.createdAt).getTime() < cutoff) return false;
    return true;
  });
}

export function clearable<T extends N>(all: T[]): string[] {
  return all.filter((n) => !isProtected(n)).map((n) => n.id);
}
