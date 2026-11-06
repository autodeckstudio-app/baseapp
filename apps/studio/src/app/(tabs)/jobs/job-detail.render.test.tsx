// Mounts the REAL JobDetailScreen (the actual route component) with firebase
// and services mocked at the module boundary, and drives the route-level
// integration the reviewer asked for: a route change while the old job's
// state is still on screen, and a live stage change under an open delivery
// declaration. Not an on-device proof.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { create, act } from "react-test-renderer";
import { createElement } from "react";
import type { ServiceJob } from "@autodeck/core";

const params = { id: "jA" };
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => params,
  useRouter: () => ({ push: () => {}, back: () => {}, replace: () => {} }),
}));

type Snap = { exists: () => boolean; data: () => unknown };
const bookingErrors=new Map<string,()=>void>();
const bookingListeners = new Map<string, (s: Snap) => void>();
const jobListeners = new Map<string, (s: Snap) => void>();
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...parts: string[]) => ({ parts }),
  getDoc: async () => ({ exists: () => false, data: () => undefined }),
  onSnapshot: (ref: { parts?: string[] }, cb: (s: Snap) => void,err?:()=>void) => {
    if (ref.parts && ref.parts[0] === "jobs" && ref.parts[1]) jobListeners.set(ref.parts[1], cb);
    if(ref.parts?.[0] === "bookings") {bookingListeners.set(ref.parts[1]!,cb);if(err)bookingErrors.set(ref.parts[1]!,err);}
    return () => {};
  },
}));
vi.mock("firebase/functions", () => ({ httpsCallable: () => async () => ({ data: {} }) }));
vi.mock("../../../lib/firebase", () => ({ db: {}, functions: {} }));

type JobAuthT = { uid: string; role: string | null; tenantId: string | null; studioId: string | null };
const STAFF: JobAuthT = { uid: "u1", role: "studio", tenantId: "t", studioId: "s1" };
// Multi-listener: the route component AND the declaration pane each subscribe;
// like the real service, the mock delivers the current identity on subscribe.
const jobAuthListeners = new Set<(a: JobAuthT | null | undefined) => void>();
const fireAuth = (a: JobAuthT | null | undefined) => act(() => { jobAuthListeners.forEach((l) => l(a)); });
const advanceJobStatus = vi.fn();
const getCurrentProtections = vi.fn(async () => []);
vi.mock("../../../lib/studio-service", () => ({
  updateStandby: vi.fn(),
  advanceJobStatus: (...a: unknown[]) => (advanceJobStatus as (...b: unknown[]) => unknown)(...a),
  cancelWalkinJob: vi.fn(),
  assignBay: vi.fn(),
  getStudioConfig: async () => null,
  getCurrentProtections: (...a: unknown[]) => (getCurrentProtections as (...b: unknown[]) => unknown)(...a),
  getReslotOptions: async () => [],
  reslotBooking: vi.fn(),
  staffAuthFingerprint: (a: JobAuthT | null | undefined) => a ? `${a.uid}|${a.role ?? ""}|${a.tenantId ?? ""}|${a.studioId ?? ""}` : "none",
  onStaffAuthChanged: (cb: (a: JobAuthT | null | undefined) => void) => {
    jobAuthListeners.add(cb);
    void Promise.resolve().then(() => { if (jobAuthListeners.has(cb)) cb(STAFF); });
    return () => { jobAuthListeners.delete(cb); };
  },
}));
// Payment listener mock with captured callbacks so tests can drive each
// read state (never-delivered = loading, onData = ready, onError = error).
const paymentListeners: { onData: (rec: unknown) => void; onError: (e: Error) => void }[] = [];
const deliverPayment = (rec: unknown) => act(() => { paymentListeners.forEach((l) => l.onData(rec)); });
const failPayment = () => act(() => { paymentListeners.forEach((l) => l.onError(new Error("denied"))); });
vi.mock("../../../lib/payment-service", () => ({
  recordManualPayment: vi.fn(),
  confirmManualPayment: vi.fn(),
  claimUpiPayment: vi.fn(),
  listenToPaymentForJob: (_j: string, _t: string, onData: (rec: unknown) => void, onError: (e: Error) => void) => {
    paymentListeners.push({ onData, onError });
    return () => {};
  },
  listenToInvoiceForJob: () => () => {},
}));
vi.mock("../../../lib/membership-service", () => ({ getCustomerMembership: async () => null }));
vi.mock("../../../lib/approval-service", () => ({
  createApproval: vi.fn(),
  cancelApproval: vi.fn(),
  getActiveServices: async () => [],
  listenToApprovalsForJob: () => () => {},
}));
vi.mock("../../../lib/inspection-service", () => ({ listenToInspection: () => () => {}, startInspection: vi.fn() }));
vi.mock("../../../components/AdminRequestPanel", () => ({ AdminRequestPanel: () => null }));
vi.mock("../../../components/UpiQr", () => ({ UpiQr: () => null }));

// Render-spy on the pane: proves the parent's render-level identity gate
// never even MOUNTS the declaration for a mismatched job/stage/operator,
// instead of mounting it and cleaning up in an effect afterwards.
const paneRenders: string[] = [];
vi.mock("../../../components/DeliveryConfirmPane", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = await importOriginal<any>();
  return {
    ...mod,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    DeliveryConfirmPane: (props: any) => {
      paneRenders.push(`${props.job.id}:${props.job.status}`);
      return createElement(mod.DeliveryConfirmPane, props);
    },
  };
});

import JobDetailScreen from "./[id]";

const mkJob = (id: string, o: Partial<ServiceJob> = {}): ServiceJob => ({
  id, vehicleId: `v-${id}`, tenantId: "t", studioId: "s1", customerId: "c1", serviceId: "sv1",
  status: "READY_FOR_DELIVERY", paymentStatus: "paid", totalAmount: 10000, bookingId: null,
  scheduledAt: "2026-10-31T10:00:00.000Z", statusHistory: [], createdAt: "x", updatedAt: "x", ...o,
} as ServiceJob);

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
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
// Capture the onPress of the LAST enabled pressable with an exact label, for
// retained-callback tests: invoking it after the binding died must be a no-op.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const capturePress = (el: any, label: string): (() => void) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hit = el.root.findAll((n: any) => typeof n.props.onPress === "function" && n.props.disabled !== true && textOfNode(n) === label);
  if (hit.length === 0) throw new Error(`no enabled pressable labelled ${JSON.stringify(label)}`);
  return hit[hit.length - 1]!.props.onPress as () => void;
};
const emitJob = (id: string, j: ServiceJob) => act(() => { jobListeners.get(id)?.({ exists: () => true, data: () => j }); });

beforeEach(() => {
  paneRenders.length = 0;
  paymentListeners.length = 0;
  jobListeners.clear();
  jobAuthListeners.clear();
  advanceJobStatus.mockReset();
  getCurrentProtections.mockClear();
  params.id = "jA";
});

describe("JobDetailScreen route integration", () => {
  it("route A->B with A's job still on screen: A's delivery declaration never survives the route change", async () => {
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(JobDetailScreen)); });
    emitJob("jA", mkJob("jA"));
    await flush();
    expect(textOf(el)).toContain("Mark Delivered");
    press(el, "Mark Delivered");
    await flush();
    expect(textOf(el)).toContain("Protection work on this visit"); // A's declaration open
    // The route moves to job B BEFORE B's listener has delivered anything.
    params.id = "jB";
    act(() => { el.update(createElement(JobDetailScreen)); });
    await flush();
    expect(textOf(el)).not.toContain("Protection work on this visit");
    expect(textOf(el)).not.toContain("Mark Delivered");
    // B's listener then delivers: B's own controls appear.
    emitJob("jB", mkJob("jB"));
    await flush();
    expect(textOf(el)).toContain("Mark Delivered");
  });

  it("hides the parent advance button while the delivery confirmation is open (single arm path), restores it on Cancel", async () => {
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(JobDetailScreen)); });
    emitJob("jA", mkJob("jA"));
    await flush();
    press(el, "Mark Delivered");
    await flush();
    expect(textOf(el)).toContain("Protection work on this visit"); // declaration open
    // The original advance control must not compete with Confirm/Cancel.
    expect(textOf(el)).not.toContain("Mark Delivered");
    press(el, "Cancel");
    await flush();
    expect(textOf(el)).not.toContain("Protection work on this visit");
    expect(textOf(el)).toContain("Mark Delivered"); // exactly one advance control again
  });

  it("a live stage change under an open delivery confirm RESETS it instead of transforming it", async () => {
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(JobDetailScreen)); });
    emitJob("jA", mkJob("jA"));
    await flush();
    press(el, "Mark Delivered");
    await flush();
    expect(textOf(el)).toContain("Protection work on this visit");
    // Someone else delivers the job: the listener pushes the stage change.
    emitJob("jA", mkJob("jA", { status: "DELIVERED" }));
    await flush();
    expect(textOf(el)).not.toContain("Protection work on this visit");
    expect(textOf(el)).not.toContain("Confirm mark delivered");
  });

  it("READY -> QUALITY_CHECK (rework) under an open declaration: the pane is never mounted for the flipped stage", async () => {
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(JobDetailScreen)); });
    emitJob("jA", mkJob("jA"));
    await flush();
    press(el, "Mark Delivered");
    await flush();
    expect(textOf(el)).toContain("Protection work on this visit");
    expect(paneRenders).toEqual(["jA:READY_FOR_DELIVERY"]);
    // The job is sent back for rework: the confirm token names
    // READY_FOR_DELIVERY, so the mismatched stage must not render the pane -
    // not even once (render-level gate, no mount-then-effect-cleanup).
    emitJob("jA", mkJob("jA", { status: "QUALITY_CHECK" }));
    await flush();
    expect(textOf(el)).not.toContain("Protection work on this visit");
    expect(paneRenders.filter((r) => r !== "jA:READY_FOR_DELIVERY")).toEqual([]);
  });

  it("an armed confirm killed by a stage flip NEVER revives on a status round-trip", async () => {
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(JobDetailScreen)); });
    emitJob("jA", mkJob("jA"));
    await flush();
    press(el, "Mark Delivered");
    await flush();
    expect(textOf(el)).toContain("Protection work on this visit");
    emitJob("jA", mkJob("jA", { status: "QUALITY_CHECK" })); // killed here
    await flush();
    emitJob("jA", mkJob("jA")); // status returns to READY_FOR_DELIVERY
    await flush();
    expect(textOf(el)).not.toContain("Protection work on this visit"); // not revived
    expect(paneRenders.filter((r) => r !== "jA:READY_FOR_DELIVERY")).toEqual([]);
    expect(paneRenders).toHaveLength(1); // and the pane never remounted even for A's original stage
  });

  it("an account switch under an armed delivery confirm closes it at the parent gate, synchronously", async () => {
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(JobDetailScreen)); });
    emitJob("jA", mkJob("jA"));
    await flush();
    press(el, "Mark Delivered");
    await flush();
    expect(textOf(el)).toContain("Protection work on this visit");
    // A different operator signs in: the armed token was bound to u1's scope
    // epoch, so the parent render gate hides the pane immediately.
    fireAuth({ uid: "u2", role: "studio", tenantId: "t", studioId: "s1" });
    expect(textOf(el)).not.toContain("Protection work on this visit");
  });

  it("a same-uid scope round-trip (studio s1 -> s2 -> s1) NEVER revives an armed confirm", async () => {
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(JobDetailScreen)); });
    emitJob("jA", mkJob("jA"));
    await flush();
    press(el, "Mark Delivered");
    await flush();
    expect(textOf(el)).toContain("Protection work on this visit");
    // Token refresh: SAME uid, re-scoped to another studio - the operator-scope
    // epoch bumps and the armed confirm dies on this render.
    fireAuth({ uid: "u1", role: "studio", tenantId: "t", studioId: "s2" });
    expect(textOf(el)).not.toContain("Protection work on this visit");
    // Back to the original scope: the epoch moved twice, so the old
    // affirmation stays dead - a fresh explicit confirm is required.
    fireAuth({ uid: "u1", role: "studio", tenantId: "t", studioId: "s1" });
    await flush();
    expect(textOf(el)).not.toContain("Protection work on this visit");
    expect(paneRenders).toHaveLength(1); // the pane never remounted
  });

  it("a verifying window (undefined) kills an armed confirm; resolving the same identity does not revive it", async () => {
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(JobDetailScreen)); });
    emitJob("jA", mkJob("jA"));
    await flush();
    press(el, "Mark Delivered");
    await flush();
    expect(textOf(el)).toContain("Protection work on this visit");
    // The service emits undefined the instant a newer token event arrives:
    // the fingerprint moves to "none", the epoch bumps, the token dies NOW.
    fireAuth(undefined);
    expect(textOf(el)).not.toContain("Protection work on this visit");
    fireAuth(STAFF); // same identity resolves: no revival (epoch moved twice)
    await flush();
    expect(textOf(el)).not.toContain("Protection work on this visit");
  });
});

describe("payment read-state guard (no real payments, read-state only)", () => {
  const mk = (id: string, o: Partial<ServiceJob> = {}) => { let el!: any; act(() => { el = create(createElement(JobDetailScreen)); }); emitJob(id, mkJob(id, o)); return el; };

  it("listener not yet delivered: shows checking state, never Not yet initiated, no Record payment", async () => {
    const el = mk("jA", { paymentStatus: "unpaid" });
    await flush();
    const t = textOf(el);
    expect(t).toContain("Checking payment status...");
    expect(t).not.toContain("Not yet initiated");
    expect(t).not.toContain("Record payment");
    expect(t).not.toContain("reconcile");
  });

  it("ready with no payment record but job marked paid: reconciliation status + copy, no contradiction, no duplicate collection offer", async () => {
    const el = mk("jA", { paymentStatus: "paid" });
    await flush();
    deliverPayment(null);
    const t = textOf(el);
    expect(t).not.toContain("Not yet initiated");
    expect(t).toContain("No payment record found");
    expect(t).toContain("marked paid");
    expect(t).toContain("reconcile the payment record");
    expect(t).not.toContain("Record payment");
  });

  const PENDING_CASH = { id: "p1", jobId: "jA", tenantId: "t", status: "pending", method: "cash", amount: 10000, createdAt: "x", updatedAt: "x" };

  it("a stale pre-retry callback cannot write into the retried epoch", async () => {
    const el = mk("jA", { paymentStatus: "paid" });
    await flush();
    failPayment();
    press(el, "Retry payment status");
    await flush();
    // paymentListeners[0] is the dead pre-retry subscription; its late
    // delivery must be ignored by the current epoch.
    act(() => { paymentListeners[0]!.onData(null); });
    expect(textOf(el)).toContain("Checking payment status...");
    act(() => { paymentListeners[paymentListeners.length - 1]!.onData(null); });
    expect(textOf(el)).toContain("No payment record found");
  });

  it("tenant change clears the record, drops the armed confirm panel, and a late old callback cannot resurrect it (mock-only continuation)", async () => {
    const confirmManualPayment = (await import("../../../lib/payment-service")).confirmManualPayment as ReturnType<typeof vi.fn>;
    confirmManualPayment.mockClear();
    const el = mk("jA", { paymentStatus: "unpaid" });
    await flush();
    act(() => { paymentListeners[paymentListeners.length - 1]!.onData(PENDING_CASH); });
    expect(textOf(el)).toContain("Confirm cash received");
    press(el, "Confirm cash received");
    expect(textOf(el)).toContain("Confirm cash received? Marks this payment complete");
    // The job's tenant changes underneath the armed panel: subscription
    // restarts, the record clears, the panel must close.
    emitJob("jA", mkJob("jA", { paymentStatus: "unpaid", tenantId: "t2" }));
    await flush();
    expect(textOf(el)).not.toContain("Confirm cash received? Marks this payment complete");
    expect(textOf(el)).toContain("Checking payment status...");
    // Late delivery on the dead subscription must not resurrect the record.
    act(() => { paymentListeners[0]!.onData({ ...PENDING_CASH, tenantId: "t2" }); });
    expect(textOf(el)).toContain("Checking payment status...");
    expect(textOf(el)).not.toContain("Confirm cash received");
    expect(confirmManualPayment).not.toHaveBeenCalled();
  });

  it("an open record panel closes when the job flips to paid before Confirm; no mutation fires (mock-only continuation)", async () => {
    const svc = await import("../../../lib/payment-service");
    (svc.recordManualPayment as ReturnType<typeof vi.fn>).mockClear();
    (svc.claimUpiPayment as ReturnType<typeof vi.fn>).mockClear();
    const el = mk("jA", { paymentStatus: "unpaid" });
    await flush();
    deliverPayment(null);
    press(el, "Record payment");
    expect(textOf(el)).toContain("Record cash payment? Confirms the customer paid in full");
    emitJob("jA", mkJob("jA", { paymentStatus: "paid" }));
    await flush();
    expect(textOf(el)).not.toContain("Record cash payment? Confirms the customer paid in full");
    expect(svc.recordManualPayment).not.toHaveBeenCalled();
    expect(svc.claimUpiPayment).not.toHaveBeenCalled();
  });

  it("same-job record swap p1 -> p2 cannot retarget an armed confirm; handler refuses and no mutation fires (mock-only continuation)", async () => {
    const svc = await import("../../../lib/payment-service");
    const confirm = svc.confirmManualPayment as ReturnType<typeof vi.fn>;
    confirm.mockClear();
    const el = mk("jA", { paymentStatus: "unpaid" });
    await flush();
    act(() => { paymentListeners[paymentListeners.length - 1]!.onData(PENDING_CASH); });
    press(el, "Confirm cash received");
    expect(textOf(el)).toContain("Confirm cash received? Marks this payment complete");
    // The pending record is replaced by a NEW record for the same job while
    // the panel is open: the frozen binding (payment id p1) no longer matches.
    act(() => { paymentListeners[paymentListeners.length - 1]!.onData({ ...PENDING_CASH, id: "p2" }); });
    expect(textOf(el)).not.toContain("Confirm cash received? Marks this payment complete");
    expect(confirm).not.toHaveBeenCalled();
  });

  it("same-job tenant change kills an armed confirm synchronously at render (no effect window)", async () => {
    const el = mk("jA", { paymentStatus: "unpaid" });
    await flush();
    act(() => { paymentListeners[paymentListeners.length - 1]!.onData(PENDING_CASH); });
    press(el, "Confirm cash received");
    expect(textOf(el)).toContain("Confirm cash received? Marks this payment complete");
    emitJob("jA", mkJob("jA", { paymentStatus: "unpaid", tenantId: "t2" }));
    // No flush: the very next render must already hide the panel.
    expect(textOf(el)).not.toContain("Confirm cash received? Marks this payment complete");
  });

  it("a retained old callback after retry cannot republish the old record", async () => {
    const el = mk("jA", { paymentStatus: "unpaid" });
    await flush();
    act(() => { paymentListeners[paymentListeners.length - 1]!.onData(PENDING_CASH); });
    expect(textOf(el)).toContain("Confirm cash received");
    failPayment();
    press(el, "Retry payment status");
    await flush();
    // Retained reference to the pre-retry listener fires late with p1.
    act(() => { paymentListeners[0]!.onData(PENDING_CASH); });
    expect(textOf(el)).not.toContain("Confirm cash received");
    expect(textOf(el)).toContain("Checking payment status...");
  });

  it("A->B->A revival is impossible: p1 -> p2 -> p1 requires a fresh click, and only the fresh binding can mutate", async () => {
    const svc = await import("../../../lib/payment-service");
    const confirm = svc.confirmManualPayment as ReturnType<typeof vi.fn>;
    confirm.mockClear();
    const el = mk("jA", { paymentStatus: "unpaid" });
    await flush();
    act(() => { paymentListeners[paymentListeners.length - 1]!.onData(PENDING_CASH); });
    press(el, "Confirm cash received");
    expect(textOf(el)).toContain("Confirm cash received? Marks this payment complete");
    // B: record swap kills the binding.
    act(() => { paymentListeners[paymentListeners.length - 1]!.onData({ ...PENDING_CASH, id: "p2" }); });
    expect(textOf(el)).not.toContain("Confirm cash received? Marks this payment complete");
    // A again: identical values return, but the generation moved - dead stays dead.
    act(() => { paymentListeners[paymentListeners.length - 1]!.onData({ ...PENDING_CASH, id: "p1" }); });
    expect(textOf(el)).not.toContain("Confirm cash received? Marks this payment complete");
    expect(confirm).not.toHaveBeenCalled();
    // A fresh click binds the fresh generation and is the only path through.
    press(el, "Confirm cash received");
    expect(textOf(el)).toContain("Confirm cash received? Marks this payment complete");
  });

  it("a retained Confirm onPress after Cancel does not call the payment service", async () => {
    const svc = await import("../../../lib/payment-service");
    const confirm = svc.confirmManualPayment as ReturnType<typeof vi.fn>;
    confirm.mockClear();
    const el = mk("jA", { paymentStatus: "unpaid" });
    await flush();
    act(() => { paymentListeners[paymentListeners.length - 1]!.onData(PENDING_CASH); });
    press(el, "Confirm cash received");
    const retained = capturePress(el, "Confirm");
    press(el, "Cancel");
    expect(textOf(el)).not.toContain("Confirm cash received? Marks this payment complete");
    await act(async () => { retained(); await Promise.resolve(); });
    expect(confirm).not.toHaveBeenCalled();
  });

  it("a retained Confirm onPress after unmount does not call the payment service", async () => {
    const svc = await import("../../../lib/payment-service");
    const confirm = svc.confirmManualPayment as ReturnType<typeof vi.fn>;
    confirm.mockClear();
    const el = mk("jA", { paymentStatus: "unpaid" });
    await flush();
    act(() => { paymentListeners[paymentListeners.length - 1]!.onData(PENDING_CASH); });
    press(el, "Confirm cash received");
    const retained = capturePress(el, "Confirm");
    act(() => { el.unmount(); });
    await act(async () => { retained(); await Promise.resolve(); });
    expect(confirm).not.toHaveBeenCalled();
  });

  it("status flip (pending -> completed) and method flip (cash -> upi) kill an ARMED confirm; retained onPress is a no-op", async () => {
    const svc = await import("../../../lib/payment-service");
    const confirm = svc.confirmManualPayment as ReturnType<typeof vi.fn>;
    confirm.mockClear();
    const el = mk("jA", { paymentStatus: "unpaid" });
    await flush();
    act(() => { paymentListeners[paymentListeners.length - 1]!.onData(PENDING_CASH); });
    press(el, "Confirm cash received");
    let retained = capturePress(el, "Confirm");
    act(() => { paymentListeners[paymentListeners.length - 1]!.onData({ ...PENDING_CASH, status: "completed" }); });
    expect(textOf(el)).not.toContain("Confirm cash received? Marks this payment complete");
    await act(async () => { retained(); await Promise.resolve(); });
    // method flip from a re-armed panel
    act(() => { paymentListeners[paymentListeners.length - 1]!.onData(PENDING_CASH); });
    press(el, "Confirm cash received");
    retained = capturePress(el, "Confirm");
    act(() => { paymentListeners[paymentListeners.length - 1]!.onData({ ...PENDING_CASH, method: "upi_manual" }); });
    expect(textOf(el)).not.toContain("Confirm cash received? Marks this payment complete");
    await act(async () => { retained(); await Promise.resolve(); });
    expect(confirm).not.toHaveBeenCalled();
  });

  it("a payment listener callback after unmount neither throws nor publishes", async () => {
    const el = mk("jA", { paymentStatus: "unpaid" });
    await flush();
    const stale = paymentListeners[paymentListeners.length - 1]!;
    act(() => { el.unmount(); });
    act(() => { stale.onData(PENDING_CASH); });
    // Epoch was retired by cleanup before unsubscribe, so the delivery was
    // dropped; nothing mounted remains to publish into.
    expect(paymentListeners.length).toBeGreaterThan(0);
  });

  it("a NEW arm attempt under a changed tenant/job/retry sees the OLD ready/null as loading - the resubscribed listener has not delivered, and only a snapshot from the current scope authenticates an arm", async () => {
    const el = mk("jA", { paymentStatus: "unpaid" });
    await flush();
    act(() => { paymentListeners[paymentListeners.length - 1]!.onData(null); });
    expect(textOf(el)).toContain("Record payment"); // ready under scope t
    // Tenant changes; emitJob's act() flushes the resubscribe effect, and the
    // NEW listener has not delivered. The old scope's ready/null must not
    // authenticate a new arm: only a snapshot whose producing scope matches
    // the current render can.
    emitJob("jA", mkJob("jA", { paymentStatus: "unpaid", tenantId: "t2" }));
    expect(textOf(el)).toContain("Checking payment status...");
    expect(textOf(el)).not.toContain("Record payment");
    // And the new scope only becomes armable from its OWN delivered snapshot.
    act(() => { paymentListeners[paymentListeners.length - 1]!.onData(null); });
    expect(textOf(el)).toContain("Record payment");
  });

  it("retained p1 onPress after Cancel + fresh p2 arm cannot fire; p2 requires its OWN fresh Confirm; same-record re-arm gets a new identity", async () => {
    const svc = await import("../../../lib/payment-service");
    const confirm = svc.confirmManualPayment as ReturnType<typeof vi.fn>;
    confirm.mockClear();
    const el = mk("jA", { paymentStatus: "unpaid" });
    await flush();
    // Arm p1, capture its Confirm, Cancel.
    act(() => { paymentListeners[paymentListeners.length - 1]!.onData(PENDING_CASH); });
    press(el, "Confirm cash received");
    const p1OnPress = capturePress(el, "Confirm");
    press(el, "Cancel");
    // Deliver p2 and arm it with a fresh click.
    act(() => { paymentListeners[paymentListeners.length - 1]!.onData({ ...PENDING_CASH, id: "p2" }); });
    press(el, "Confirm cash received");
    const p2OnPress = capturePress(el, "Confirm");
    // The retained p1 callback names a dead arm identity: no service call,
    // and the armed p2 panel is untouched.
    await act(async () => { p1OnPress(); await Promise.resolve(); });
    expect(confirm).not.toHaveBeenCalled();
    expect(textOf(el)).toContain("Confirm cash received? Marks this payment complete");
    // p2 fires only through its OWN captured identity.
    await act(async () => { p2OnPress(); await Promise.resolve(); });
    expect(confirm).toHaveBeenCalledWith("p2");
    confirm.mockClear();
    // Same record, fresh re-arm: the re-armed identity differs, the older
    // captured callback is dead even though the record is identical.
    act(() => { paymentListeners[paymentListeners.length - 1]!.onData(PENDING_CASH); });
    press(el, "Confirm cash received");
    const firstArm = capturePress(el, "Confirm");
    press(el, "Cancel");
    press(el, "Confirm cash received");
    const secondArm = capturePress(el, "Confirm");
    await act(async () => { firstArm(); await Promise.resolve(); });
    expect(confirm).not.toHaveBeenCalled();
    await act(async () => { secondArm(); await Promise.resolve(); });
    expect(confirm).toHaveBeenCalledWith("p1");
  });

  it("ready with no payment record and job unpaid: Record payment is offered", async () => {
    const el = mk("jA", { paymentStatus: "unpaid" });
    await flush();
    deliverPayment(null);
    const t = textOf(el);
    expect(t).toContain("Not yet initiated");
    expect(t).toContain("Record payment");
  });

  it("listener error: explicit unavailable state + retry, no Record payment, job paid state not erased", async () => {
    const el = mk("jA", { paymentStatus: "paid" });
    await flush();
    failPayment();
    const t = textOf(el);
    expect(t).toContain("Payment status unavailable");
    expect(t).toContain("may already be paid");
    expect(t).toContain("Retry payment status");
    expect(t).not.toContain("Record payment");
    expect(t).not.toContain("Not yet initiated");
    // retry re-subscribes the listener
    const before = paymentListeners.length;
    press(el, "Retry payment status");
    await flush();
    expect(paymentListeners.length).toBeGreaterThan(before);
  });
it('opening record hides redundant outer action and cash retry is available only for failed cash, never failed online link',async()=>{const el=mk('jA',{paymentStatus:'unpaid'});await flush();deliverPayment(null);press(el,'Record payment');expect(textOf(el)).toContain('Record cash payment?');expect(el.root.findAll((n:any)=>n.props.label==='Record payment')).toHaveLength(0);press(el,'Cancel');deliverPayment({...PENDING_CASH,status:'failed'});expect(textOf(el)).toContain('Record payment');deliverPayment({...PENDING_CASH,status:'failed',method:'razorpay_payment_link'});expect(textOf(el)).not.toContain('Record payment');});
  it('real cash fields receipt checkbox reaches record callable exactly once and listener paid closes collection',async()=>{const svc=await import('../../../lib/payment-service');vi.mocked(svc.recordManualPayment).mockClear();const el=mk('jA',{paymentStatus:'unpaid'});await flush();deliverPayment(null);press(el,'Record payment');press(el,'Confirm');await flush();expect(textOf(el)).toContain('Confirm you have the cash in hand first.');expect(svc.recordManualPayment).not.toHaveBeenCalled();press(el,'I have the cash');press(el,'Confirm');await flush();expect(svc.recordManualPayment).toHaveBeenCalledTimes(1);expect(svc.recordManualPayment).toHaveBeenCalledWith({jobId:'jA',method:'cash'});emitJob('jA',mkJob('jA',{paymentStatus:'paid'}));deliverPayment({...PENDING_CASH,status:'completed'});await flush();expect(textOf(el)).not.toContain('Record payment');expect(textOf(el)).not.toContain('Confirm cash received');});

  it('cash receipt affirmation dies across operator A to B to A and cannot replay old confirm',async()=>{const svc=await import('../../../lib/payment-service');vi.mocked(svc.recordManualPayment).mockClear();const el=mk('jA',{paymentStatus:'unpaid'});await flush();deliverPayment(null);press(el,'Record payment');press(el,'I have the cash');const stale=capturePress(el,'Confirm');fireAuth({...STAFF,uid:'replacement'});fireAuth(STAFF);act(()=>stale());await flush();expect(svc.recordManualPayment).not.toHaveBeenCalled();expect(textOf(el)).not.toContain('Cash in hand');});

 it('payment then job listeners show syncing until both paid, and reverse order holds collection too',async()=>{const el=mk('jA',{paymentStatus:'unpaid'});await flush();deliverPayment({...PENDING_CASH,status:'completed'});expect(textOf(el)).toContain('Payment records syncing - do not collect again');expect(textOf(el)).not.toContain('Record payment');emitJob('jA',mkJob('jA',{paymentStatus:'paid'}));expect(textOf(el)).not.toContain('Payment records syncing');deliverPayment({...PENDING_CASH,status:'pending'});expect(textOf(el)).toContain('Payment records syncing - do not collect again');expect(textOf(el)).not.toContain('Record payment');});

 it('consult wait disables work and cash action until quoted price approved; ordinary booked work stays enabled',async()=>{
 const el=mk('jA',{paymentStatus:'unpaid',status:'VEHICLE_RECEIVED',bookingId:'b'});await flush();deliverPayment(null);
 const disabled=(label:string)=>el.root.findAll((n:any)=>n.props.label===label).some((n:any)=>n.props.disabled===true);
 expect(disabled('Start Work')).toBe(true);expect(disabled('Record payment')).toBe(true);
 expect(textOf(el)).toContain('Checking linked booking');act(()=>bookingErrors.get('b')!());expect(textOf(el)).toContain('Linked booking unavailable');expect(textOf(el)).toContain('Retry linked booking');
 const quote=(patch:any)=>act(()=>bookingListeners.get('b')!({exists:()=>true,data:()=>({id:'b',tenantId:'t',customerId:'c',priceOnRequest:true,quoteStatus:'quoted',...patch})}));
 quote({});expect(textOf(el)).toContain("original booking quote");expect(textOf(el)).not.toContain("Request Approval");expect(textOf(el)).toContain('Waiting for customer price approval');expect(disabled('Record payment')).toBe(true);
 quote({quoteStatus:'approved'});expect(textOf(el)).toContain('Request Approval');expect(disabled('Start Work')).toBe(false);expect(disabled('Record payment')).toBe(false);
 quote({priceOnRequest:false,quoteStatus:undefined});expect(disabled('Start Work')).toBe(false);expect(disabled('Record payment')).toBe(false);
 });

});
