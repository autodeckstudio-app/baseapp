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
 * from the previous cycle reach the server.
 *
 * Ordering WITHIN one identity: every refresh takes an operation number and
 * only the latest operation may land. An older response that arrives after a
 * newer one is dropped wholesale, so out-of-order completions can never
 * resurrect rows the newer truth already resolved, and a stale completion
 * never clears the spinner a newer request still owns.
 *
 * dispose() invalidates every pending operation and detaches listeners:
 * after unmount, no late response can touch state or notify anyone. */
export function createRefundWorkCycle(list: (knownIds: string[]) => Promise<RefundWork>) {
  let generation = 0;
  let accum: Map<string, LegacyRefundClaim> = new Map();
  let work: RefundWork | null = null;
  let loading = false;
  let error: string | null = null;
  let tail: Promise<unknown> = Promise.resolve();
  let inFlight = 0;
  const listeners = new Set<() => void>();
  const emit = () => { for (const l of listeners) l(); };

  /** SERIALIZED scan queue: listRefundWork advances persisted backend cursors,
   * so two competing calls would consume DISTINCT pages - discarding either
   * response would lose rows forever. Refreshes therefore chain: at most one
   * call is in flight, every issued call lands (unless its identity is gone),
   * and each call sends the known-id set as of ITS OWN start, not the caller's
   * enqueue time. */
  function refresh(knownIds?: string[]): Promise<void> {
    const gen = generation;
    inFlight += 1;
    loading = true;
    emit();
    const run = tail.then(async () => {
      if (gen !== generation) return; // stale identity: consume nothing, apply nothing
      try {
        const w = await list(knownIds ?? [...accum.keys()]);
        if (gen !== generation) return; // identity changed mid-flight: drop silently
        work = w;
        accum = mergeWorkIntoAccum(accum, w);
        error = null;
        emit();
      } catch (err) {
        if (gen !== generation) return; // stale error must not surface
        error = err instanceof Error ? err.message : "Refund work unavailable.";
        emit();
      }
    });
    tail = run.catch(() => undefined);
    return run.finally(() => {
      inFlight -= 1;
      // The spinner belongs to the live identity's queue as a whole.
      if (inFlight === 0 && gen === generation) { loading = false; emit(); }
    });
  }

  return {
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
    getState(): RefundWorkCycleState { return { accum, work, loading, error }; },
    /** Current identity generation. Async actions (outbox run, reconcile)
     * capture this before awaiting and must no-op - no message, no spinner,
     * no refresh - whenever it has changed by the time they settle. */
    generation(): number { return generation; },
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
    /** Unmount/dispose: every pending or queued response becomes a no-op and
     * no listener is ever notified again. */
    dispose() {
      generation += 1;
      accum = new Map();
      work = null;
      error = null;
      loading = false;
      listeners.clear();
    },
  };
}
