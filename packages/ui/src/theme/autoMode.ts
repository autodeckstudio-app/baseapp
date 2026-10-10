// Automatic day/night. Night when the device asks for dark mode, or when
// the user's local clock is outside day hours (6 AM to 7 PM). No manual
// toggle: the device's own setting and the clock decide.
export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 19;

export function isNightByClock(date: Date): boolean {
  const h = date.getHours();
  return h < DAY_START_HOUR || h >= DAY_END_HOUR;
}

export function resolveMode(date: Date, deviceDark: boolean): "light" | "night" {
  return deviceDark || isNightByClock(date) ? "night" : "light";
}

/** Reads the device preference from the browser, or false when unavailable. */
export function deviceWantsDark(): boolean {
  const g = globalThis as { matchMedia?: (q: string) => { matches: boolean } };
  try {
    return g.matchMedia?.("(prefers-color-scheme: dark)").matches === true;
  } catch {
    return false;
  }
}

export function currentMode(): "light" | "night" {
  return resolveMode(new Date(), deviceWantsDark());
}

/** Calls back when the mode flips (checked each minute and on media-query change). Returns an unsubscribe. */
export function watchMode(onChange: (mode: "light" | "night") => void): () => void {
  let last = currentMode();
  const check = () => {
    const next = currentMode();
    if (next !== last) {
      last = next;
      onChange(next);
    }
  };
  const timer = setInterval(check, 30_000);
  const g = globalThis as { matchMedia?: (q: string) => { addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void } };
  const mq = g.matchMedia?.("(prefers-color-scheme: dark)");
  mq?.addEventListener?.("change", check);
  const doc = (globalThis as { document?: { addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void } }).document;
  doc?.addEventListener("visibilitychange", check);
  return () => {
    clearInterval(timer);
    mq?.removeEventListener?.("change", check);
    doc?.removeEventListener("visibilitychange", check);
  };
}
