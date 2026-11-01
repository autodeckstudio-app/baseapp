// Mounts the REAL JobControls (the actual parent) + REAL DeliveryDeclaration
// with firebase and the admin auth context mocked at the module boundary, and
// drives the interaction paths the static/source tests cannot: an actual
// declaration submission, render-level identity gating on stage flips, a
// dropped late completion, and a same-uid claims change invalidating context.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { create, act } from "react-test-renderer";
import { createElement } from "react";
import type { Protection, ServiceJob } from "@autodeck/core";

// --- module-boundary mocks -------------------------------------------------
const getDocs = vi.fn();
const advanceCallable = vi.fn();
vi.mock("firebase/firestore", () => ({
  collection: (...a: unknown[]) => ({ a }),
  query: (...a: unknown[]) => ({ a }),
  where: (...a: unknown[]) => ({ a }),
  getDocs: (...a: unknown[]) => getDocs(...a),
  doc: (...a: unknown[]) => ({ a }),
  getDoc: async () => ({ exists: () => false, data: () => undefined }),
}));
vi.mock("firebase/functions", () => ({
  httpsCallable: () => (payload: unknown) => advanceCallable(payload),
}));
vi.mock("../lib/firebase", () => ({ db: {}, functions: {} }));

type AuthValue = { user: { uid: string } | null; claims: { role: string; tenantId: string; studioId: string | null } | null; loading: boolean };
let authValue: AuthValue = { user: { uid: "u1" }, claims: { role: "admin", tenantId: "t", studioId: "s1" }, loading: false };
vi.mock("../lib/auth-context", () => ({ useAdminAuth: () => authValue }));

// Render-spy: proves render-level identity gating never MOUNTS the
// declaration for a mismatched job/stage/operator.
const declRenders: string[] = [];
vi.mock("./DeliveryDeclaration", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = (await importOriginal()) as any;
  return {
    ...mod,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    DeliveryDeclaration: (props: any) => {
      declRenders.push(`${props.job.id}:${props.job.status}`);
      return createElement(mod.DeliveryDeclaration, props);
    },
  };
});

import { JobControls } from "./JobControls";

const prot = (id: string, o: Partial<Protection> = {}): Protection => ({ id, tenantId: "t", vehicleId: "vA", customerId: "c", kind: "ppf", provider: "Garware", policyNumber: null, startDate: "2026-06-12", expiryDate: null, documentUrl: null, status: "unverified", source: "customer", verifiedBy: null, verifiedAt: null, notes: null, revision: 2, coverage: "full_body", createdAt: "x", updatedAt: "x", ...o });
const job = (o: Partial<ServiceJob> = {}): ServiceJob => ({ id: "jA", vehicleId: "vA", tenantId: "t", studioId: "s1", status: "READY_FOR_DELIVERY", paymentStatus: "paid", serviceId: "sv1", ...o } as ServiceJob);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const textOf = (el: any): string => {
  const walk = (n: any): string => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (n === null || n === undefined || typeof n === "boolean") return "";
    if (typeof n === "string") return n;
    if (Array.isArray(n)) return n.map(walk).join(" ");
    return walk(n.children);
  };
  return walk(el.toJSON()).replace(/\s+/g, " ").trim();
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function click(el: any, label: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hit = el.root.findAll((n: any) => typeof n.props.onClick === "function" && n.props.disabled !== true && textOf({ toJSON: () => n }) === label);
  if (hit.length === 0) throw new Error(`no enabled clickable labelled ${JSON.stringify(label)}; saw: ${textOf(el)}`);
  act(() => { hit[hit.length - 1].props.onClick(); });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clickRaw(el: any, label: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hit = el.root.findAll((n: any) => typeof n.props.onClick === "function" && textOf({ toJSON: () => n }) === label);
  if (hit.length === 0) return; // absent: fine for "never fires" assertions
  hit[hit.length - 1].props.onClick();
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setRadio(el: any, checkedLabelFragment: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hit = el.root.findAll((n: any) => n.type === "input" && n.props.type === "radio" && typeof n.props.onChange === "function");
  const target = checkedLabelFragment === "work" ? hit[1] : hit[0];
  act(() => { target.props.onChange(); });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickSelect(el: any, ariaLabel: string, value: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hit = el.root.findAll((n: any) => n.type === "select" && n.props["aria-label"] === ariaLabel);
  if (hit.length === 0) throw new Error(`no select labelled ${ariaLabel}`);
  act(() => { hit[0].props.onChange({ target: { value } }); });
}
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  getDocs.mockReset();
  advanceCallable.mockReset();
  declRenders.length = 0;
  authValue = { user: { uid: "u1" }, claims: { role: "admin", tenantId: "t", studioId: "s1" }, loading: false };
});

describe("JobControls + DeliveryDeclaration mounted interaction", () => {
  it("an actual replace declaration submits through the real chain with the frozen payload", async () => {
    getDocs.mockResolvedValue({ docs: [{ id: "p1", data: () => ({ ...prot("p1"), id: "ignored-stored-id" }) }] });
    advanceCallable.mockResolvedValue({ data: {} });
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(JobControls, { job: job() })); });
    click(el, "Mark delivered");
    await flush();
    expect(textOf(el)).toContain("Protection work on this visit");
    setRadio(el, "work");
    click(el, "Add replace");
    pickSelect(el, "Replace target 1", "p1");
    click(el, "Confirm mark delivered");
    await flush();
    expect(advanceCallable).toHaveBeenCalledTimes(1);
    const payload = advanceCallable.mock.calls[0]![0] as { jobId: string; protectionWork: { action: string; targetProtectionId: string | null; expectedRevision: number | null; kind: string; coverage: string }[] };
    expect(payload.jobId).toBe("jA");
    expect(payload.protectionWork).toHaveLength(1);
    const ev = payload.protectionWork[0]!;
    expect(ev.action).toBe("replace");
    expect(ev.targetProtectionId).toBe("p1"); // doc-id authoritative over stored id
    expect(ev.expectedRevision).toBe(2);
    expect(ev.kind).toBe("ppf"); // like-for-like from the target
    expect(ev.coverage).toBe("full_body");
  });

  it("READY -> QUALITY_CHECK under an open declaration: never mounted for the flipped stage", async () => {
    getDocs.mockResolvedValue({ docs: [] });
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(JobControls, { job: job() })); });
    click(el, "Mark delivered");
    await flush();
    expect(textOf(el)).toContain("Protection work on this visit");
    expect(declRenders).toEqual(["jA:READY_FOR_DELIVERY"]);
    // Live rework flip: the armed token names READY_FOR_DELIVERY, so the
    // render-level gate excludes the pane for the new stage - no mount, no
    // effect cleanup after the fact.
    act(() => { el.update(createElement(JobControls, { job: job({ status: "QUALITY_CHECK" }) })); });
    expect(textOf(el)).not.toContain("Protection work on this visit");
    expect(declRenders.filter((r) => r !== "jA:READY_FOR_DELIVERY")).toEqual([]);
  });

  it("an armed confirm killed by a stage flip NEVER revives on a status round-trip", async () => {
    getDocs.mockResolvedValue({ docs: [] });
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(JobControls, { job: job() })); });
    click(el, "Mark delivered");
    await flush();
    expect(textOf(el)).toContain("Protection work on this visit");
    act(() => { el.update(createElement(JobControls, { job: job({ status: "QUALITY_CHECK" }) })); });
    act(() => { el.update(createElement(JobControls, { job: job() })); }); // round-trip back
    expect(textOf(el)).not.toContain("Protection work on this visit");
    expect(declRenders).toHaveLength(1); // never remounted
  });

  it("a completion resolving after the context moved is dropped - no publish, lock released for reload", async () => {
    getDocs.mockResolvedValue({ docs: [] });
    let finish!: (v: unknown) => void;
    advanceCallable.mockReturnValue(new Promise((res) => { finish = res; }));
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(JobControls, { job: job() })); });
    click(el, "Mark delivered");
    await flush();
    setRadio(el, "none");
    click(el, "Confirm mark delivered");
    // The job moves under the in-flight commit.
    act(() => { el.update(createElement(JobControls, { job: job({ id: "jB", vehicleId: "vB" }) })); });
    act(() => { finish({ data: {} }); });
    await flush();
    expect(textOf(el)).not.toContain("Could not mark delivered");
    // B never saw A's declaration rendered as its own.
    expect(declRenders.filter((r) => r.startsWith("jB"))).toEqual([]);
  });

  it("a SAME-UID claims change (role re-scope) kills the armed declaration at the parent gate; a claims round-trip never revives it", async () => {
    getDocs.mockResolvedValue({ docs: [] });
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(JobControls, { job: job() })); });
    click(el, "Mark delivered");
    await flush();
    expect(textOf(el)).toContain("Protection work on this visit");
    // Same uid, new role claim: the operator-scope epoch (uid+role+tenant+
    // studio) bumps and the parent kills the armed affirmation on THIS
    // render - the declaration unmounts, not just invalidates internally.
    authValue = { user: { uid: "u1" }, claims: { role: "superadmin", tenantId: "t", studioId: null }, loading: false };
    act(() => { el.update(createElement(JobControls, { job: job() })); });
    expect(textOf(el)).not.toContain("Protection work on this visit");
    // Back to the original claims: the epoch moved twice, so no revival.
    authValue = { user: { uid: "u1" }, claims: { role: "admin", tenantId: "t", studioId: "s1" }, loading: false };
    act(() => { el.update(createElement(JobControls, { job: job() })); });
    expect(textOf(el)).not.toContain("Protection work on this visit");
    expect(declRenders).toHaveLength(1); // never remounted
  });

  it("a provider verification window disarms an armed confirm; resolving the SAME claims does not revive it", async () => {
    getDocs.mockResolvedValue({ docs: [] });
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(JobControls, { job: job() })); });
    click(el, "Mark delivered");
    await flush();
    expect(textOf(el)).toContain("Protection work on this visit");
    // Token event: the provider keeps the old claims but marks the session
    // verifying (loading) - retained claims are NOT affirmable.
    authValue = { ...authValue, loading: true };
    act(() => { el.update(createElement(JobControls, { job: job() })); });
    expect(textOf(el)).not.toContain("Protection work on this visit");
    // Same claims return: the epoch moved twice - no revival, a fresh
    // explicit reaffirm is required.
    authValue = { ...authValue, loading: false };
    act(() => { el.update(createElement(JobControls, { job: job() })); });
    expect(textOf(el)).not.toContain("Protection work on this visit");
    expect(declRenders).toHaveLength(1); // never remounted
  });

  it("a terminal round-trip (READY -> DELIVERED -> READY) never revives an armed confirm - the kill runs outside the next-action branch", async () => {
    getDocs.mockResolvedValue({ docs: [] });
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(JobControls, { job: job() })); });
    click(el, "Mark delivered");
    await flush();
    expect(textOf(el)).toContain("Protection work on this visit");
    // Delivered by someone else: DELIVERED has no next action, so the branch
    // carrying the token disappears entirely - the kill must still run.
    act(() => { el.update(createElement(JobControls, { job: job({ status: "DELIVERED" }) })); });
    expect(textOf(el)).not.toContain("Protection work on this visit");
    // A correction moves the job back to READY: the old affirmation stays dead.
    act(() => { el.update(createElement(JobControls, { job: job() })); });
    expect(textOf(el)).not.toContain("Protection work on this visit");
    expect(declRenders).toHaveLength(1); // never remounted
  });
});
