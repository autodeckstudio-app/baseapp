import { useSyncExternalStore } from "react";

// One shared clock for every timing label: a single timer for the whole app, ticking on the minute,
// running only while something is subscribed and (on web) while the page is visible.
// Elapsed/countdown text refreshes without a reload; nothing is written anywhere.
let now = Date.now();
const subs = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

// Web only: React Native has no document, so the clock simply keeps ticking there.
interface Doc { visibilityState?: string; addEventListener(t: string, f: () => void): void; removeEventListener(t: string, f: () => void): void }
const doc = (): Doc | undefined => (globalThis as { document?: Doc }).document;
const hidden = (): boolean => doc()?.visibilityState === "hidden";

function tick(): void {
  timer = undefined;
  if (subs.size === 0) return;
  if (!hidden()) {
    now = Date.now();
    subs.forEach((f) => f());
  }
  schedule();
}

function schedule(): void {
  if (timer !== undefined || subs.size === 0) return;
  timer = setTimeout(tick, 60000 - (Date.now() % 60000) + 50); // next minute boundary
}

function onVisible(): void {
  if (!hidden() && subs.size > 0) { now = Date.now(); subs.forEach((f) => f()); }
}

function subscribe(cb: () => void): () => void {
  subs.add(cb);
  if (subs.size === 1) doc()?.addEventListener("visibilitychange", onVisible);
  now = Date.now();
  schedule();
  return () => {
    subs.delete(cb);
    if (subs.size === 0) {
      if (timer !== undefined) { clearTimeout(timer); timer = undefined; }
      doc()?.removeEventListener("visibilitychange", onVisible);
    }
  };
}

/** Current time in ms, refreshed once a minute while mounted. Pass the result to visitTiming(job, now). */
export function useMinuteNow(): number {
  return useSyncExternalStore(subscribe, () => now, () => now);
}
