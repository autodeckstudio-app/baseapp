import type { Protection } from "@autodeck/core";
import { reconcileProtectionReadback, upsertProtection } from "./protection-readback";

/**
 * The car-detail protection save orchestration. The screen owns React state;
 * this flow owns validity: every publication (busy, error, editor close,
 * list change) is gated on the attempt's generation still being current and
 * the flow still being alive, so a late response from an older attempt, a
 * closed editor, a different car, an auth change or an unmounted screen can
 * never publish. The screen invalidates on editor open/cancel and route or
 * auth change, and disposes on unmount.
 */
export type ProtectionSaveEffect =
  | { type: "busy"; value: boolean }
  | { type: "closeEditor" }
  | { type: "error"; message: string }
  | { type: "upsert"; targetId: string; protection: Protection }
  | { type: "remove"; targetId: string };

export type ServerSnap = { exists: boolean; data?: Record<string, unknown> | undefined; snapId: string };

export const CREATE_SAVE_UNCONFIRMED =
  "Could not confirm the save. Trying again is safe - the same declaration is retried, never duplicated.";
const CHANGED_SHOWN = "These details changed since you opened them. The latest saved version is now shown - review it, then make your edit again.";
const UNCONFIRMED_SHOWN = "Could not confirm the save, but the latest saved details are now shown - check them before trying again.";
const REMOVED_COPY = "This record is no longer saved - it may have been removed. Your edit is still here unchanged; cancel to discard it, or add the details again as new.";
const CORRUPT_COPY = "The saved record could not be matched to this car, so nothing on screen was changed. Your edit is still here unchanged.";
const CHANGED_OFFLINE = "These details changed since you opened them, and the latest version could not be loaded right now (you may be offline). Your edit is still here unchanged - check your connection, review the saved details when they load, then try again.";
const UNCONFIRMED_OFFLINE = "Could not confirm whether the save landed, and the latest saved details could not be loaded right now. Your edit is still here unchanged - when the saved details load, compare them before trying again so nothing is entered twice.";

export class ProtectionSaveFlow {
  private seq = 0;
  private alive = true;
  constructor(private readonly emit: (e: ProtectionSaveEffect) => void) {}
  /** Editor opened or cancelled, route or auth changed: any in-flight
   *  attempt belongs to the previous context and must never publish. */
  invalidate(): void { this.seq += 1; }
  /** Screen unmounted (or StrictMode's probe cleanup): nothing may publish.
   *  Paired with revive() from the effect setup so a StrictMode remount or
   *  fast-refresh cycle brings the SAME flow back rather than leaving it
   *  permanently dead. */
  dispose(): void { this.alive = false; this.seq += 1; }
  revive(): void { this.alive = true; }
  private valid(g: number): boolean { return this.alive && g === this.seq; }

  async run(args: {
    mode: "create" | "edit";
    target: Protection | null; // the record being edited (edit mode)
    vehicleId: string;
    uid: string;
    tenantId: string;
    save: () => Promise<void>;
    /** Read-back seam bound to THIS attempt's captured car and target - a
     *  late response can never read a different car's path. */
    fetch: () => Promise<ServerSnap>;
    /** Live context predicate (car + signed-in identity), read at EVERY
     *  gate - not captured truth. Between a context-changing render and its
     *  effect this is the only thing that blocks an old attempt from
     *  publishing into the new context. */
    contextCurrent: () => boolean;
  }): Promise<void> {
    // Gate BEFORE any side effect or network: a disposed flow (unmounted or
    // StrictMode probe) must not emit busy, must not call save.
    if (!this.alive) return;
    const g = ++this.seq;
    const ok = () => this.valid(g) && args.contextCurrent();
    if (!ok()) return;
    this.emit({ type: "busy", value: true });
    try {
      await args.save();
      if (!ok()) return;
      this.emit({ type: "closeEditor" });
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      // Both modes gate on validity first: a stale attempt publishes nothing.
      if (!ok()) return;
      if (args.mode !== "edit" || !args.target) {
        // Create mode: the retry replays the same declarationId, which the
        // server dedups exactly - the one path where "never duplicated" is
        // verified.
        this.emit({ type: "error", message: CREATE_SAVE_UNCONFIRMED });
        return;
      }
      const target = args.target;
      // Confirm what the server actually has before saying anything about
      // "latest": the listener may be offline and showing a cached copy.
      let outcome: ReturnType<typeof reconcileProtectionReadback>;
      try {
        const snap = await args.fetch();
        outcome = reconcileProtectionReadback({
          exists: snap.exists,
          data: snap.data,
          snapId: snap.snapId,
          targetId: target.id,
          vehicleId: args.vehicleId,
          customerId: args.uid,
          tenantId: args.tenantId,
          generation: g,
          currentGeneration: this.seq,
        });
      } catch {
        outcome = ok() ? { kind: "unconfirmed" } : { kind: "stale" };
      }
      if (outcome.kind === "stale" || !ok()) return;
      const conflict = /failed-precondition/.test(code);
      if (outcome.kind === "applied") {
        this.emit({ type: "upsert", targetId: target.id, protection: outcome.protection });
        this.emit({ type: "closeEditor" });
        this.emit({ type: "error", message: conflict ? CHANGED_SHOWN : UNCONFIRMED_SHOWN });
      } else if (outcome.kind === "removed") {
        // The server no longer has the record: a fact, not an offline
        // condition. Drop it from the saved list (displaying it would
        // assert a record that does not exist); the draft stays open.
        this.emit({ type: "remove", targetId: target.id });
        this.emit({ type: "error", message: REMOVED_COPY });
      } else if (outcome.kind === "corrupt") {
        this.emit({ type: "error", message: CORRUPT_COPY });
      } else {
        this.emit({ type: "error", message: conflict ? CHANGED_OFFLINE : UNCONFIRMED_OFFLINE });
      }
    } finally {
      // Only the current attempt may release the form: an older attempt's
      // finally must never unlock a newer in-flight save. After an
      // invalidate without a new attempt the editor is closed, so busy is
      // irrelevant; the next open resets it.
      if (ok()) this.emit({ type: "busy", value: false });
    }
  }
}

