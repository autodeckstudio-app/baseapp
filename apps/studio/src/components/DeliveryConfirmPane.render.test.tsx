// Mounts the REAL DeliveryConfirmPane (the exact component the job screen
// renders for a delivery) with studio-service mocked at the module boundary,
// and drives the integration paths a helper-level test cannot reach: late
// fetches racing a route change, live-job updates invalidating context,
// reload re-review, same-tick double submit, and record integrity.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { create, act } from "react-test-renderer";
import { createElement } from "react";
import type { Protection, ServiceJob } from "@autodeck/core";

const workState=vi.hoisted(()=>({value:null as any}));
vi.mock('../lib/work-coverage-service',()=>({getStaffJobWorkCoverage:async(jobId:string)=>workState.value??({status:'not_recorded',jobId,revision:null,workLock:'open',items:[]})}));
const getCurrentProtections = vi.fn();
const advanceJobStatus = vi.fn();
type StaffAuthT = { uid: string; role: string | null; tenantId: string | null; studioId: string | null };
const STAFF: StaffAuthT = { uid: "u1", role: "studio", tenantId: "t", studioId: "s1" };
// The listener is the pane's ONLY auth source (no independent seed). Like
// the real service, the mock delivers the current identity on subscribe -
// unless a test opts out to drive the verifying window itself.
let currentAuth: StaffAuthT | null = STAFF;
let autoFire = true;
let authListener: ((a: StaffAuthT | null | undefined) => void) | null = null;
vi.mock("../lib/studio-service", () => ({
  getCurrentProtections: (...a: unknown[]) => getCurrentProtections(...a),
  advanceJobStatus: (...a: unknown[]) => advanceJobStatus(...a),
  onStaffAuthChanged: (cb: (a: StaffAuthT | null | undefined) => void) => {
    authListener = cb;
    if (autoFire) { const v = currentAuth; void Promise.resolve().then(() => { if (authListener === cb) cb(v); }); }
    return () => { authListener = null; };
  },
}));

import { DeliveryConfirmPane } from "./DeliveryConfirmPane";

const prot = (id: string, o: Partial<Protection> = {}): Protection => ({ id, tenantId: "t", vehicleId: "vA", customerId: "c", kind: "ppf", provider: "Garware", policyNumber: null, startDate: "2026-06-12", expiryDate: null, documentUrl: null, status: "unverified", source: "customer", verifiedBy: null, verifiedAt: null, notes: null, revision: 2, coverage: "full_body", createdAt: "x", updatedAt: "x", ...o });
const job = (o: Partial<ServiceJob> = {}): ServiceJob => ({ id: "jA", vehicleId: "vA", tenantId: "t", studioId: "s1", status: "READY_FOR_DELIVERY", ...o } as ServiceJob);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const textOf = (el: any): string => {
  const walk = (n: any): string => {
    if (n === null || n === undefined || typeof n === "boolean") return "";
    if (typeof n === "string") return n;
    if (Array.isArray(n)) return n.map(walk).join(" ");
    return walk(n.children);
  };
  return walk(el.toJSON()).replace(/\s+/g, " ").trim();
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const textOfNode = (n: any): string => {
  const walk = (x: any): string => {
    if (x === null || x === undefined || typeof x === "boolean") return "";
    if (typeof x === "string") return x;
    if (Array.isArray(x)) return x.map(walk).join("");
    return walk(x.children);
  };
  try { return walk(n.toJSON ? n.toJSON() : n).replace(/\s+/g, " ").trim(); } catch { return ""; }
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function press(el: any, label: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hit = el.root.findAll((n: any) => typeof n.props.onPress === "function" && n.props.disabled !== true && textOfNode(n) === label);
  if (hit.length === 0) throw new Error(`no enabled pressable labelled ${JSON.stringify(label)}`);
  act(() => { hit[hit.length - 1].props.onPress(); });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pressRaw(el: any, label: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hit = el.root.findAll((n: any) => typeof n.props.onPress === "function" && textOfNode(n) === label);
  if (hit.length === 0) throw new Error(`no pressable labelled ${JSON.stringify(label)}`);
  hit[hit.length - 1].props.onPress();
}
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

let resolveA: (v: Protection[]) => void;
beforeEach(() => {
  workState.value=null;
  getCurrentProtections.mockReset();
  advanceJobStatus.mockReset();
  currentAuth = STAFF;
  autoFire = true;
  authListener = null;
});

describe("DeliveryConfirmPane mounted", () => {
  it("visible loading, never overlapping the panel; records appear only after the fetch resolves", async () => {
    getCurrentProtections.mockReturnValue(new Promise((res) => { resolveA = res; }));
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(DeliveryConfirmPane, { job: job(), onDelivered: () => {}, onCancel: () => {} })); });
    expect(textOf(el)).toContain("Verifying the signed-in account"); // auth gate precedes any load
    await flush(); // auth verified; the records fetch starts (still pending)
    expect(textOf(el)).toContain("Loading the car's protection records");
    expect(textOf(el)).not.toContain("No protection work");
    resolveA([prot("p1")]);
    await flush();
    expect(textOf(el)).toContain("No protection work");
  });

  it("a late fetch after the route moved to another job never applies the old car's records", async () => {
    getCurrentProtections.mockReturnValue(new Promise((res) => { resolveA = res; }));
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(DeliveryConfirmPane, { job: job(), onDelivered: () => {}, onCancel: () => {} })); });
    await flush(); // auth verified; job A's fetch is in flight
    // Route moves to job B (another car) BEFORE job A's fetch resolves.
    act(() => { el.update(createElement(DeliveryConfirmPane, { job: job({ id: "jB", vehicleId: "vB" }), onDelivered: () => {}, onCancel: () => {} })); });
    expect(textOf(el)).toContain("This job changed since the declaration was opened");
    resolveA([prot("pA")]); // A's late answer arrives now
    await flush();
    // A's records were dropped: no target chip from car A is offered under B.
    expect(textOf(el)).not.toContain("ref pA");
  });

  it("a live status change under the pane blocks confirm with honest copy and no reload path", async () => {
    getCurrentProtections.mockResolvedValue([prot("p1")]);
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(DeliveryConfirmPane, { job: job(), onDelivered: () => {}, onCancel: () => {} })); });
    await flush();
    press(el, "No protection work");
    act(() => { el.update(createElement(DeliveryConfirmPane, { job: job({ status: "DELIVERED" }), onDelivered: () => {}, onCancel: () => {} })); });
    expect(textOf(el)).toContain("no longer awaiting delivery");
    pressRaw(el, "Confirm mark delivered");
    await flush();
    expect(advanceJobStatus).not.toHaveBeenCalled();
  });

  it("reload re-reviews: a stale frozen selection does not survive, and the fresh record builds at its new revision", async () => {
    getCurrentProtections.mockResolvedValue([prot("p1")]);
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(DeliveryConfirmPane, { job: job(), onDelivered: () => {}, onCancel: () => {} })); });
    await flush();
    press(el, "Record work");
    press(el, "Add removal");
    press(el, "PPF - Full body (Garware) - 2026-06-12 - customer entry - ref p1");
    // The record changes on the backend; staff reload to re-review.
    getCurrentProtections.mockResolvedValue([prot("p1", { revision: 3 })]);
    press(el, "Reload records");
    await flush();
    // The remounted panel has no selection: confirm stays invalid.
    pressRaw(el, "Confirm mark delivered");
    expect(advanceJobStatus).not.toHaveBeenCalled();
    // Re-selecting the fresh record freezes revision 3 and submits that.
    press(el, "Record work");
    press(el, "Add removal");
    press(el, "PPF - Full body (Garware) - 2026-06-12 - customer entry - ref p1");
    advanceJobStatus.mockResolvedValue({ jobId: "jA" });
    press(el, "Confirm mark delivered");
    await flush();
    expect(advanceJobStatus).toHaveBeenCalledTimes(1);
    expect(advanceJobStatus.mock.calls[0]?.[3]).toEqual([{ action: "remove", targetProtectionId: "p1", expectedRevision: 3 }]);
  });

  it("a same-tick double confirm submits once, with the payload frozen at press time", async () => {
    getCurrentProtections.mockResolvedValue([]);
    let never!: () => void;
    advanceJobStatus.mockReturnValue(new Promise((res) => { never = () => res({ jobId: "jA" }); }));
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(DeliveryConfirmPane, { job: job(), onDelivered: () => {}, onCancel: () => {} })); });
    await flush();
    press(el, "No protection work");
    pressRaw(el, "Confirm mark delivered");
    pressRaw(el, "Confirm mark delivered"); // same tick: must be ignored
    await flush();
    expect(advanceJobStatus).toHaveBeenCalledTimes(1);
    expect(advanceJobStatus.mock.calls[0]?.[3]).toEqual([]); // explicit none, frozen
    // While pending the confirm swaps to its loading state (not pressable
    // at all); the ref lock above is what guards the same-tick window.
    never();
  });

  it("a record that fails the vehicleId integrity check blocks delivery with an explicit alert", async () => {
    getCurrentProtections.mockResolvedValue([prot("pX", { vehicleId: "vOTHER" })]);
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(DeliveryConfirmPane, { job: job(), onDelivered: () => {}, onCancel: () => {} })); });
    await flush();
    expect(textOf(el)).toContain("integrity check");
    pressRaw(el, "Confirm mark delivered");
    expect(advanceJobStatus).not.toHaveBeenCalled();
  });

  it("a failed submit stays open with the backend's message and can be retried", async () => {
    getCurrentProtections.mockResolvedValue([]);
    advanceJobStatus.mockRejectedValueOnce(new Error("Confirm the protection work declaration before delivering."));
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(DeliveryConfirmPane, { job: job(), onDelivered: () => {}, onCancel: () => {} })); });
    await flush();
    press(el, "No protection work");
    press(el, "Confirm mark delivered");
    await flush();
    expect(textOf(el)).toContain("Confirm the protection work declaration before delivering.");
    advanceJobStatus.mockResolvedValue({ jobId: "jA" });
    const onDelivered = vi.fn();
    act(() => { el.update(createElement(DeliveryConfirmPane, { job: job(), onDelivered, onCancel: () => {} })); });
    press(el, "Confirm mark delivered");
    await flush();
    expect(advanceJobStatus).toHaveBeenCalledTimes(2);
  });

  it("an account switch invalidates the open declaration - the earlier operator's affirmation never ships", async () => {
    getCurrentProtections.mockResolvedValue([]);
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(DeliveryConfirmPane, { job: job(), onDelivered: () => {}, onCancel: () => {} })); });
    await flush();
    press(el, "No protection work");
    act(() => { authListener?.({ uid: "u2", role: "studio", tenantId: "t", studioId: "s1" }); }); // signed-in account changes mid-pane
    expect(textOf(el)).toContain("The account or its permissions changed, or it cannot deliver for this studio.");
    expect(textOf(el)).toContain("The earlier declaration cannot be used. Reload and review it again.");
    pressRaw(el, "Confirm mark delivered");
    expect(advanceJobStatus).not.toHaveBeenCalled();
    // Explicit reload under the new account re-aims and can then deliver.
    advanceJobStatus.mockResolvedValue({ jobId: "jA" });
    press(el, "Reload declaration");
    await flush();
    press(el, "No protection work");
    press(el, "Confirm mark delivered");
    await flush();
    expect(advanceJobStatus).toHaveBeenCalledTimes(1);
  });

  it("a SAME-UID claim change (role/tenant/studio re-scope) invalidates the open declaration", async () => {
    getCurrentProtections.mockResolvedValue([]);
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(DeliveryConfirmPane, { job: job(), onDelivered: () => {}, onCancel: () => {} })); });
    await flush();
    press(el, "No protection work");
    // Token refresh: same uid, new role claim - a different operator context.
    act(() => { authListener?.({ uid: "u1", role: "admin", tenantId: "t", studioId: "s1" }); });
    expect(textOf(el)).toContain("The account or its permissions changed, or it cannot deliver for this studio.");
    expect(textOf(el)).toContain("The earlier declaration cannot be used. Reload and review it again.");
    pressRaw(el, "Confirm mark delivered");
    expect(advanceJobStatus).not.toHaveBeenCalled();
    // Same for a studio re-scope under the same uid.
    act(() => { el.update(createElement(DeliveryConfirmPane, { job: job(), onDelivered: () => {}, onCancel: () => {} })); });
    await flush();
    act(() => { authListener?.({ uid: "u1", role: "studio", tenantId: "t", studioId: "s2" }); });
    expect(textOf(el)).toContain("The account or its permissions changed, or it cannot deliver for this studio.");
    expect(textOf(el)).toContain("The earlier declaration cannot be used. Reload and review it again.");
  });

  it("signed-out is INVALID, never a valid anonymous context; auth unverified shows a verifying state", async () => {
    getCurrentProtections.mockResolvedValue([]);
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(DeliveryConfirmPane, { job: job(), onDelivered: () => {}, onCancel: () => {} })); });
    await flush();
    act(() => { authListener?.(null); }); // sign-out mid-pane
    expect(textOf(el)).toContain("The account or its permissions changed, or it cannot deliver for this studio.");
    expect(textOf(el)).toContain("The earlier declaration cannot be used. Reload and review it again.");
    pressRaw(el, "Confirm mark delivered");
    expect(advanceJobStatus).not.toHaveBeenCalled();
    // Fresh mount with auth slow to verify: nothing affirmable until the
    // listener's first event arrives.
    autoFire = false;
    el.unmount();
    act(() => { el = create(createElement(DeliveryConfirmPane, { job: job(), onDelivered: () => {}, onCancel: () => {} })); });
    expect(textOf(el)).toContain("Verifying the signed-in account");
    pressRaw(el, "Confirm mark delivered");
    expect(advanceJobStatus).not.toHaveBeenCalled();
    act(() => { authListener?.(STAFF); });
    await flush();
    expect(textOf(el)).not.toContain("Verifying the signed-in account");
  });

  it("signed-out at open is NEVER a valid context, and reload cannot aim one", async () => {
    currentAuth = null; // signed out from the start
    getCurrentProtections.mockResolvedValue([]);
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(DeliveryConfirmPane, { job: job(), onDelivered: () => {}, onCancel: () => {} })); });
    await flush();
    expect(textOf(el)).toContain("The account or its permissions changed, or it cannot deliver for this studio.");
    expect(textOf(el)).toContain("The earlier declaration cannot be used. Reload and review it again.");
    pressRaw(el, "Confirm mark delivered");
    expect(advanceJobStatus).not.toHaveBeenCalled();
    pressRaw(el, "Reload declaration");
    await flush();
    expect(getCurrentProtections).not.toHaveBeenCalled(); // reload under signed-out is a no-op
  });

  it("a token event mid-pane swaps to verifying SYNCHRONOUSLY and demands EXPLICIT reaffirm - no implicit same-identity restoration", async () => {
    getCurrentProtections.mockResolvedValue([]);
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(DeliveryConfirmPane, { job: job(), onDelivered: () => {}, onCancel: () => {} })); });
    await flush();
    press(el, "No protection work");
    // The service emits `undefined` (verifying) the instant a newer token
    // event arrives, BEFORE its claims resolve: the prior affirmed identity
    // must not be serviceable in that window.
    act(() => { authListener?.(undefined); });
    expect(textOf(el)).toContain("Verifying the signed-in account");
    pressRaw(el, "Confirm mark delivered");
    await flush();
    expect(advanceJobStatus).not.toHaveBeenCalled();
    // Resolving to the SAME verified identity does NOT restore the
    // affirmation: every token epoch requires an explicit reaffirm.
    act(() => { authListener?.(STAFF); });
    await flush();
    expect(textOf(el)).toContain("The account or its permissions changed, or it cannot deliver for this studio.");
    expect(textOf(el)).toContain("The earlier declaration cannot be used. Reload and review it again.");
    pressRaw(el, "Confirm mark delivered");
    expect(advanceJobStatus).not.toHaveBeenCalled();
    // Explicit reload re-aims under the new token epoch; the dropped draft
    // does not survive - re-select, then confirm ships.
    advanceJobStatus.mockResolvedValue({ jobId: "jA" });
    press(el, "Reload declaration");
    await flush();
    press(el, "No protection work");
    press(el, "Confirm mark delivered");
    await flush();
    expect(advanceJobStatus).toHaveBeenCalledTimes(1);
  });

  it("a token refresh during a PENDING submit drops the completion and leaves NO stuck pending", async () => {
    getCurrentProtections.mockResolvedValue([]);
    let finish!: (v: unknown) => void;
    advanceJobStatus.mockReturnValue(new Promise((res) => { finish = res; }));
    const onDelivered = vi.fn();
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(DeliveryConfirmPane, { job: job(), onDelivered, onCancel: () => {} })); });
    await flush();
    press(el, "No protection work");
    pressRaw(el, "Confirm mark delivered"); // submit in flight
    // Token event mid-commit: verifying, then the SAME identity resolves.
    act(() => { authListener?.(undefined); });
    act(() => { authListener?.(STAFF); });
    act(() => { finish({ jobId: "jA" }); });
    await flush();
    expect(onDelivered).not.toHaveBeenCalled(); // dropped completion publishes nothing
    // No stuck pending: the explicit reaffirm path is available and enabled.
    expect(textOf(el)).toContain("The account or its permissions changed, or it cannot deliver for this studio.");
    expect(textOf(el)).toContain("The earlier declaration cannot be used. Reload and review it again.");
    advanceJobStatus.mockResolvedValue({ jobId: "jA" });
    press(el, "Reload declaration"); // throws if still disabled by a stuck pending
    await flush();
    press(el, "No protection work");
    press(el, "Confirm mark delivered");
    await flush();
    expect(onDelivered).toHaveBeenCalledTimes(1);
  });

  it("a signature round-trip A -> B -> A does NOT revive a pending old-A completion", async () => {
    getCurrentProtections.mockResolvedValue([]);
    let finish!: (v: unknown) => void;
    advanceJobStatus.mockReturnValue(new Promise((res) => { finish = res; }));
    const onDelivered = vi.fn();
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(DeliveryConfirmPane, { job: job(), onDelivered, onCancel: () => {} })); });
    await flush();
    press(el, "No protection work");
    press(el, "Confirm mark delivered");
    act(() => { el.update(createElement(DeliveryConfirmPane, { job: job({ id: "jB", vehicleId: "vB" }), onDelivered, onCancel: () => {} })); });
    act(() => { el.update(createElement(DeliveryConfirmPane, { job: job(), onDelivered, onCancel: () => {} })); }); // back to A
    act(() => { finish({ jobId: "jA" }); });
    await flush();
    expect(onDelivered).not.toHaveBeenCalled(); // the round-trip killed the attempt
    expect(textOf(el)).not.toContain("Could not mark delivered");
  });

  it("a submit resolving after the route moved is dropped - A's completion never closes B's pane", async () => {
    getCurrentProtections.mockResolvedValue([]);
    let finish!: (v: unknown) => void;
    advanceJobStatus.mockReturnValue(new Promise((res) => { finish = res; }));
    const onDelivered = vi.fn();
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(DeliveryConfirmPane, { job: job(), onDelivered, onCancel: () => {} })); });
    await flush();
    press(el, "No protection work");
    press(el, "Confirm mark delivered");
    // Route moves to job B while A's commit is in flight. Reload is handler-
    // guarded while the commit is pending: pressing it starts NO new load.
    act(() => { el.update(createElement(DeliveryConfirmPane, { job: job({ id: "jB", vehicleId: "vB" }), onDelivered, onCancel: () => {} })); });
    const loadsBefore = getCurrentProtections.mock.calls.length;
    press(el, "Reload declaration");
    expect(getCurrentProtections.mock.calls.length).toBe(loadsBefore);
    act(() => { finish({ jobId: "jA" }); }); // A's late completion arrives now
    await flush();
    expect(onDelivered).not.toHaveBeenCalled(); // B's pane was not closed by A
    expect(textOf(el)).not.toContain("Could not mark delivered");
    // The lock released with the dropped publication: an explicit reload for
    // B is now possible.
    press(el, "Reload declaration");
    await flush();
    expect(textOf(el)).toContain("No protection work");
  });
});

  it("recorded sealed QC work replaces re-entry with automatic exact-revision handover, never a manual none",async()=>{
    workState.value={status:'recorded',jobId:'jA',revision:5,workLock:'locked',handoverReady:true,items:[]};getCurrentProtections.mockResolvedValue([]);let el:any;await act(async()=>{el=create(createElement(DeliveryConfirmPane,{job:job(),onDelivered:vi.fn(),onCancel:vi.fn()}))});
    expect(textOf(el)).toContain("checked work record is used automatically");expect(textOf(el)).not.toContain('No protection work');
    const b=(label:string)=>el.root.findAll((n:any)=>n.props.label===label&&n.props.onPress)[0];expect(el.root.findAll((n:any)=>n.props.label==='Use recorded work')).toHaveLength(0);expect(b('Confirm mark delivered').props.disabled).toBe(false);advanceJobStatus.mockResolvedValue({});await act(async()=>b('Confirm mark delivered').props.onPress());expect(advanceJobStatus).toHaveBeenCalledWith('jA',undefined,undefined,undefined,5);await act(async()=>el.unmount());
  });
  it("partial or unsealed recorded work cannot fall back to manual none or guessed handover",async()=>{
    for(const state of[{status:'recorded',workLock:'open',handoverReady:false},{status:'needs_review',workLock:'unknown',handoverReady:false}]){workState.value={...state,jobId:'jA',revision:3,items:[]};getCurrentProtections.mockResolvedValue([]);let el:any;await act(async()=>{el=create(createElement(DeliveryConfirmPane,{job:job(),onDelivered:vi.fn(),onCancel:vi.fn()}))});expect(textOf(el)).not.toContain('No protection work');expect(textOf(el)).toContain('Finish recording, QC');expect(el.root.findAll((n:any)=>n.props.label==='Confirm mark delivered'&&n.props.onPress)[0].props.disabled).toBe(true);await act(async()=>el.unmount())}
  });
  it('automatic record reuse fails closed for a different visit or invalid revision',async()=>{
    for(const record of[{jobId:'other',revision:5},{jobId:'jA',revision:null},{jobId:'jA',revision:0}]){workState.value={status:'recorded',workLock:'locked',handoverReady:true,items:[],...record};getCurrentProtections.mockResolvedValue([]);let el:any;await act(async()=>{el=create(createElement(DeliveryConfirmPane,{job:job(),onDelivered:vi.fn(),onCancel:vi.fn()}))});expect(el.root.findAll((n:any)=>n.props.label==='Confirm mark delivered'&&n.props.onPress)[0].props.disabled).toBe(true);expect(textOf(el)).not.toContain('No protection work');await act(async()=>el.unmount())}
  });
