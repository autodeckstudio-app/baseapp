// Exactly-once idempotency key persistence for UI actions (reviewer requirement).
// A retry of the SAME intent (double-tap, re-render, network retry after a
// timeout) must reuse the stored key so the server sees a retry, not a new
// attempt. Changing the intent (a different slot, the opposite decision) mints
// a NEW key - the old key is never reused with a different payload, which the
// server would reject as a conflict.
export function intentKey<T>(current: { intent: T; key: string } | null, next: T, makeKey: () => string): { intent: T; key: string } {
  if (current && current.intent === next) return current;
  return { intent: next, key: makeKey() };
}
