import type { RefundWorkCycle } from "./refund-work-cycle";

export type RefundActionSink = {
  setBusy: (busy: boolean) => void;
  setMessage: (message: string | null) => void;
};

/** Identity-bound runner for the refund write actions (outbox run, claim
 * reconciliation). The generation is captured BEFORE the action starts; every
 * post-await effect - result message, error message, spinner release, and the
 * follow-up list refresh - lands only while the identity is unchanged. After
 * logout/tenant switch/dispose a late success, error or finally is a complete
 * no-op: it cannot contaminate the new identity's message, spinner or rows,
 * and it cannot start a list call the new identity never asked for.
 *
 * The identity-change RESET of busy/message lives in the page's identity
 * effect (it owns the React state); this runner only guarantees late
 * callbacks never disturb the new identity after that reset. */
export async function runRefundAction<T>(
  cycle: Pick<RefundWorkCycle, "generation" | "refresh">,
  action: () => Promise<T>,
  format: (r: T) => string,
  failureFallback: string,
  sink: RefundActionSink,
): Promise<void> {
  const gen = cycle.generation();
  sink.setBusy(true);
  sink.setMessage(null);
  try {
    const r = await action();
    if (cycle.generation() !== gen) return;
    sink.setMessage(format(r));
  } catch (err) {
    if (cycle.generation() !== gen) return;
    sink.setMessage(err instanceof Error ? err.message : failureFallback);
  } finally {
    if (cycle.generation() === gen) {
      sink.setBusy(false);
      void cycle.refresh();
    }
  }
}
