// Scroll direction signal for the bottom nav: shrinks while the page scrolls down, returns on scroll up.
type Fn = (compact: boolean) => void;
const subs = new Set<Fn>();
let last = 0;
let compact = false;

export function reportScroll(y: number): void {
  const dy = y - last;
  last = y;
  let next = compact;
  if (y < 24) next = false;
  else if (dy > 6) next = true;
  else if (dy < -6) next = false;
  if (next !== compact) {
    compact = next;
    subs.forEach((f) => f(compact));
  }
}

export function resetNavScroll(): void {
  last = 0;
  if (compact) { compact = false; subs.forEach((f) => f(false)); }
}

export function onNavCompact(f: Fn): () => void {
  subs.add(f);
  return () => { subs.delete(f); };
}
