/** Distance and direction a swipe needs before it changes the tab. */
export const SWIPE_MIN_DX = 48;
export const SWIPE_AXIS_RATIO = 1.6;

/** Swiping left shows the next tab, swiping right the previous one. Returns null at either end or for a mostly vertical drag. */
export function swipeTarget<K extends string>(keys: readonly K[], current: K, dx: number, dy: number): K | null {
  if (Math.abs(dx) < SWIPE_MIN_DX || Math.abs(dx) < Math.abs(dy) * SWIPE_AXIS_RATIO) return null;
  const i = keys.indexOf(current);
  if (i < 0) return null;
  const next = dx < 0 ? i + 1 : i - 1;
  return next >= 0 && next < keys.length ? keys[next]! : null;
}

