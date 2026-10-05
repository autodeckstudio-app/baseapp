// Tiny event bus so a tab press can tell the visible screen to scroll to its top.
type Fn = (tab: string) => void;
const subs = new Set<Fn>();
export function onTabPressed(fn: Fn): () => void {
  subs.add(fn);
  return () => { subs.delete(fn); };
}
export function emitTabPressed(tab: string): void {
  subs.forEach((f) => f(tab));
}
