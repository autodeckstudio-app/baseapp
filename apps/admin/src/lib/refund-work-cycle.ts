import type { LegacyRefundClaim, RefundWork } from "./refund-work-service";

export type RefundWorkCycleState = {
  accum: Map<string, LegacyRefundClaim>;
  work: RefundWork | null;
  loading: boolean;
  error: string | null;
};

/** Accumulate a fresh page into the known rows and apply authoritative truth:
 * new pages update/extend rows keyed by paymentId; rows the server reports
 * resolved or released are dropped AS resolved (truth, not cursor advance);
 * still-held rows update in place. */
export function mergeWorkIntoAccum(prev: Map<string, LegacyRefundClaim>, work: RefundWork): Map<string, LegacyRefundClaim> {
  const next = new Map(prev);
  for (const c of work.legacyClaims) next.set(c.paymentId, c);
  for (const t of work.claimTruth) {
    if (t.state === "resolved" || t.state === "released") next.delete(t.paymentId);
    else {
      const row = next.get(t.paymentId);
      if (row) next.set(t.paymentId, { ...row, reconcileState: t.state, reconcileNote: t.note });
    }
  }
  return next;
}

export type RefundWorkCycle = ReturnType<typeof createRefundWorkCycle>;

/** Identity-scoped review cycle for the refund-work surface. EVERY identity
 * change - login, tenant switch AND logout - bumps the generation and resets
 * the cycle, so a delayed response from a previous identity can never
 * repopulate the new identity's rows, surface its error, or move its spinner.
 * A fresh identity's first refresh sends an empty known-id set: no stale ids
 * from the previous cycle reach the server. */
export function createRefundWorkCycle(list: (knownIds: string[]) => Promise<RefundWork>) {
  let generation = 0;
  let accum: Map<string, LegacyRefundClaim> = new Map();
  let work: RefundWork | null = null;
  let loading = false;
  let error: string | null = null;
  const listeners = new Set<() => void>();
  const emit = () => { for (const l of listeners) l(); };

  async function refresh(knownIds?: string[]) {
    const gen = generation;
    loading = true;
    emit();
    try {
      const w = await list(knownIds ?? [...accum.keys()]);
      if (gen !== generation) return; // stale identity response: drop silently
      work = w;
      accum = mergeWorkIntoAccum(accum, w);
      error = null;
    } catch (err) {
      if (gen !== generation) return; // stale identity error must not surface
      error = err instanceof Error ? err.message : "Refund work unavailable.";
    } finally {
      if (gen === generation) { loading = false; emit(); }
    }
  }

  return {
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
    getState(): RefundWorkCycleState { return { accum, work, loading, error }; },
    reset(signedIn: boolean) {
      generation += 1;
      accum = new Map();
      work = null;
      error = null;
      loading = signedIn;
      emit();
      if (signedIn) void refresh([]);
    },
    refresh,
  };
}
