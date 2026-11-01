// Mounts the REAL VehicleLookupPage (parent) + REAL VehiclesView with the
// service/auth/router boundaries mocked, and drives the interaction paths
// source tests cannot: the correction payload names the FROZEN viewed
// target (never ambient state), a disarmed correction submits nothing, late
// async results never publish into a newer view, and a deferred save never
// ghosts a confirmation into the car the admin moved to.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { create, act, type ReactTestRenderer } from "react-test-renderer";
import { createElement } from "react";
import type { Protection, Vehicle } from "@autodeck/core";

const findVehicle = vi.fn();
const getProtections = vi.fn();
const getPapers = vi.fn();
const createProtection = vi.fn();
const updateProtection = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
type AuthValue = { user: { uid: string } | null; claims: { role: string; tenantId: string; studioId: string | null } | null; loading: boolean };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const draft = { provider: "X", policyNumber: null, startDate: null, expiryDate: null, notes: null, warrantyYears: null, coverage: undefined } as any;
let authValue: AuthValue = { user: { uid: "a1" }, claims: { role: "admin", tenantId: "t", studioId: null }, loading: false };
vi.mock("../../../lib/auth-context", () => ({ useAdminAuth: () => authValue }));
vi.mock("../../../lib/use-labels", () => ({ useLabels: () => ({}) }));
vi.mock("../../../lib/format", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../../lib/format")>()), studioToday: () => "2026-10-31" }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const listenFleet = vi.fn<any>(() => () => {});
vi.mock("../../../lib/customers-service", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listenToTenantVehicles: (...a: any[]) => (listenFleet as any)(...a),
}));
vi.mock("../../../lib/protection-service", () => ({
  findVehicleByRegistration: (...a: unknown[]) => findVehicle(...a),
  getVehicleProtections: (...a: unknown[]) => getProtections(...a),
  createProtection: (...a: unknown[]) => createProtection(...a),
  updateProtection: (...a: unknown[]) => updateProtection(...a),
}));
vi.mock("../../../lib/papers-service", () => ({ getVehiclePapers: (...a: unknown[]) => getPapers(...a) }));

import VehicleLookupPage from "./page";

const car = (id: string, plate: string) => ({ id, tenantId: "t", ownerId: `o-${id}`, registrationNumber: plate, createdAt: "2026-01-01" }) as Vehicle;
const prot = (id: string, vehicleId: string, o: Partial<Protection> = {}): Protection => ({
  id, tenantId: "t", vehicleId, customerId: `o-${vehicleId}`, kind: "ppf",
  provider: "Garware", policyNumber: "P-1", startDate: "2026-06-12", expiryDate: "2031-06-12",
  documentUrl: null, status: "unverified", source: "customer", verifiedBy: null, verifiedAt: null,
  notes: null, revision: 2, coverage: "full_body", createdAt: "2026-06-12T00:00:00Z", updatedAt: "2026-06-13T00:00:00Z",
  ...o,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const textOf = (n: any): string => {
  if (n == null || typeof n === "boolean") return "";
  if (typeof n === "string") return n;
  if (Array.isArray(n)) return n.map(textOf).join(" ");
  return textOf(n.children ?? n.props?.children);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const allText = (r: ReactTestRenderer): string => textOf(r.toJSON()).replace(/\s+/g, " ");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buttonByText = (r: ReactTestRenderer, label: string): any =>
  r.root.findAllByType("button").find((b) => textOf(b).replace(/\s+/g, " ").trim() === label);
async function search(r: ReactTestRenderer, plate: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const input = r.root.findAllByType("input").find((i: any) => i.props["aria-label"] === "Number plate")!;
  await act(async () => { input.props.onChange({ target: { value: plate } }); });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // Find the search form by its plate input (the button label flips to
  // "Looking" while a search is in flight, so it cannot be the anchor).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = r.root.findAllByType("form").find((f: any) => f.findAllByType("input").some((i: any) => i.props["aria-label"] === "Number plate"))!;
  await act(async () => { form.props.onSubmit({ preventDefault: () => {} }); });
}

beforeEach(() => {
  findVehicle.mockReset(); getProtections.mockReset(); getPapers.mockReset();
  createProtection.mockReset(); updateProtection.mockReset();
  getPapers.mockResolvedValue([]);
  listenFleet.mockReset();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listenFleet.mockImplementation(() => () => {});
  authValue = { user: { uid: "a1" }, claims: { role: "admin", tenantId: "t", studioId: null }, loading: false };
});

describe("VehicleLookupPage correction identity + ordering", () => {
  it("submits the correction against the FROZEN car+record with revision binding, not ambient state", async () => {
    const A = car("vA", "GJ01AB1234");
    findVehicle.mockResolvedValue(A);
    getProtections.mockResolvedValue([prot("p1", "vA")]);
    updateProtection.mockResolvedValue(undefined);
    let r!: ReactTestRenderer;
    await act(async () => { r = create(createElement(VehicleLookupPage)); });
    await search(r, "GJ01AB1234");
    await act(async () => { buttonByText(r, "Correct").props.onClick(); });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await act(async () => { r.root.findAllByType("input").find((i: any) => i.props.type === "radio" && textOf(i.parent).includes("Keep as recorded"))!.props.onChange(); });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const form = r.root.findAllByType("form").find((f: any) => f.findAllByType("button").some((b: any) => textOf(b).trim() === "Save correction"))!;
    await act(async () => { form.props.onSubmit({ preventDefault: () => {} }); });
    expect(updateProtection).toHaveBeenCalledTimes(1);
    const payload = updateProtection.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload.vehicleId).toBe("vA");
    expect(payload.protectionId).toBe("p1");
    expect(payload.expectedRevision).toBe(2);
    expect(payload.legacyBaseUpdatedAt).toBeUndefined(); // versioned record: no fingerprint
    expect(payload.coverage).toBeUndefined(); // keep: no scope key
    expect(allText(r)).toContain("Correction saved.");
  });

  it("legacy record: fingerprint names the reviewed updatedAt string", async () => {
    const A = car("vA", "GJ01AB1234");
    findVehicle.mockResolvedValue(A);
    getProtections.mockResolvedValue([prot("pL", "vA", { revision: undefined as never })]);
    updateProtection.mockResolvedValue(undefined);
    let r!: ReactTestRenderer;
    await act(async () => { r = create(createElement(VehicleLookupPage)); });
    await search(r, "GJ01AB1234");
    await act(async () => { buttonByText(r, "Correct").props.onClick(); });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await act(async () => { r.root.findAllByType("input").find((i: any) => i.props.type === "radio" && textOf(i.parent).includes("Keep as recorded"))!.props.onChange(); });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const form = r.root.findAllByType("form").find((f: any) => f.findAllByType("button").some((b: any) => textOf(b).trim() === "Save correction"))!;
    await act(async () => { form.props.onSubmit({ preventDefault: () => {} }); });
    const payload = updateProtection.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload.expectedRevision).toBe(0);
    expect(payload.legacyBaseUpdatedAt).toBe("2026-06-13T00:00:00Z");
  });

  it("A->B->A: the open correction disarms and submits NOTHING (retained callback cannot retarget)", async () => {
    const A = car("vA", "GJ01AB1234");
    const B = car("vB", "GJ02CD5678");
    findVehicle.mockImplementation((_t: string, plate: string) => Promise.resolve(plate.includes("AB") ? A : B));
    // B has a protection with the SAME id+revision: the retarget trap.
    getProtections.mockImplementation((_t: string, vid: string) => Promise.resolve([prot("p1", vid)]));
    let r!: ReactTestRenderer;
    await act(async () => { r = create(createElement(VehicleLookupPage)); });
    await search(r, "GJ01AB1234");
    await act(async () => { buttonByText(r, "Correct").props.onClick(); });
    await search(r, "GJ02CD5678"); // navigate away while the form was open
    expect(allText(r)).toContain("GJ02CD5678");
    expect(updateProtection).not.toHaveBeenCalled();
    await search(r, "GJ01AB1234"); // back to A: form must not revive
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(r.root.findAllByType("form").filter((f: any) => f.findAllByType("button").some((b: any) => textOf(b).trim() === "Save correction"))).toHaveLength(0);
    expect(updateProtection).not.toHaveBeenCalled();
  });

  it("late results never publish: deferred search A resolves after B and is dropped", async () => {
    const A = car("vA", "GJ01AB1234");
    const B = car("vB", "GJ02CD5678");
    let resolveA!: (v: Vehicle) => void;
    findVehicle.mockImplementation((_t: string, plate: string) =>
      plate.includes("AB") ? new Promise<Vehicle>((res) => { resolveA = res; }) : Promise.resolve(B));
    getProtections.mockImplementation((_t: string, vid: string) => Promise.resolve([prot(`p-${vid}`, vid)]));
    let r!: ReactTestRenderer;
    await act(async () => { r = create(createElement(VehicleLookupPage)); });
    await search(r, "GJ01AB1234"); // in flight, unresolved
    await search(r, "GJ02CD5678"); // B wins the view
    expect(allText(r)).toContain("GJ02CD5678");
    await act(async () => { resolveA(A); }); // A lands late - must be dropped
    expect(allText(r)).toContain("GJ02CD5678");
    expect(allText(r)).not.toContain("p-vA");
  });

  it("deferred save: navigating away before the save resolves ghosts no confirmation", async () => {
    const A = car("vA", "GJ01AB1234");
    const B = car("vB", "GJ02CD5678");
    findVehicle.mockImplementation((_t: string, plate: string) => Promise.resolve(plate.includes("AB") ? A : B));
    getProtections.mockImplementation((_t: string, vid: string) => Promise.resolve([prot("p1", vid)]));
    let resolveSave!: () => void;
    updateProtection.mockImplementation(() => new Promise<void>((res) => { resolveSave = res; }));
    let r!: ReactTestRenderer;
    await act(async () => { r = create(createElement(VehicleLookupPage)); });
    await search(r, "GJ01AB1234");
    await act(async () => { buttonByText(r, "Correct").props.onClick(); });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await act(async () => { r.root.findAllByType("input").find((i: any) => i.props.type === "radio" && textOf(i.parent).includes("Keep as recorded"))!.props.onChange(); });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const form = r.root.findAllByType("form").find((f: any) => f.findAllByType("button").some((b: any) => textOf(b).trim() === "Save correction"))!;
    await act(async () => { form.props.onSubmit({ preventDefault: () => {} }); });
    expect(updateProtection).toHaveBeenCalledTimes(1); // the save itself fired for A
    await search(r, "GJ02CD5678"); // admin moves on before the ack
    await act(async () => { resolveSave(); });
    expect(allText(r)).toContain("GJ02CD5678");
    expect(allText(r)).not.toContain("Correction saved."); // no ghost confirmation in B's view
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function retainOnCorrect(r: ReactTestRenderer): (...a: any[]) => void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return r.root.findByProps({ today: "2026-10-31" } as never).props.onCorrect as (...a: any[]) => void;
  }
  async function armOnA(r: ReactTestRenderer) {
    await act(async () => { buttonByText(r, "Correct").props.onClick(); });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await act(async () => { r.root.findAllByType("input").find((i: any) => i.props.type === "radio" && textOf(i.parent).includes("Keep as recorded"))!.props.onChange(); });
  }

  it("page boundary: a RETAINED onCorrect prop invoked after navigation no-ops", async () => {
    const A = car("vA", "GJ01AB1234");
    const B = car("vB", "GJ02CD5678");
    findVehicle.mockImplementation((_t: string, plate: string) => Promise.resolve(plate.includes("AB") ? A : B));
    getProtections.mockImplementation((_t: string, vid: string) => Promise.resolve([prot("p1", vid)]));
    let r!: ReactTestRenderer;
    await act(async () => { r = create(createElement(VehicleLookupPage)); });
    await search(r, "GJ01AB1234");
    const retained = retainOnCorrect(r);
    await search(r, "GJ02CD5678"); // view moved to B
    // A stale retained invocation still names car A: the page must refuse it
    // even with a plausible-looking captured fingerprint.
    await act(async () => { retained(A, prot("p1", "vA"), draft, "vA|t|o-vA|a1|t||admin|ready|2"); });
    expect(updateProtection).not.toHaveBeenCalled();
  });

  it("page boundary: retained invocation after A->B->A no-ops (selection generation moved)", async () => {
    const A = car("vA", "GJ01AB1234");
    const B = car("vB", "GJ02CD5678");
    findVehicle.mockImplementation((_t: string, plate: string) => Promise.resolve(plate.includes("AB") ? A : B));
    getProtections.mockImplementation((_t: string, vid: string) => Promise.resolve([prot("p1", vid)]));
    updateProtection.mockResolvedValue(undefined);
    let r!: ReactTestRenderer;
    await act(async () => { r = create(createElement(VehicleLookupPage)); });
    await search(r, "GJ01AB1234");
    const retained = retainOnCorrect(r);
    await search(r, "GJ02CD5678");
    await search(r, "GJ01AB1234"); // back to A: id/tenant/owner all match again
    await act(async () => { retained(A, prot("p1", "vA"), draft, "vA|t|o-vA|a1|t||admin|ready|2"); });
    expect(updateProtection).not.toHaveBeenCalled(); // the selection generation moved on
  });

  it("page boundary: invocation while auth is verifying no-ops", async () => {
    const A = car("vA", "GJ01AB1234");
    findVehicle.mockResolvedValue(A);
    getProtections.mockResolvedValue([prot("p1", "vA")]);
    let r!: ReactTestRenderer;
    await act(async () => { r = create(createElement(VehicleLookupPage)); });
    await search(r, "GJ01AB1234");
    const retained = retainOnCorrect(r);
    await act(async () => {
      authValue = { ...authValue, loading: true }; // verifying: nothing affirmable
      r.update(createElement(VehicleLookupPage));
    });
    await act(async () => { retained(A, prot("p1", "vA"), draft, "vA|t|o-vA|a1|t||admin|ready|2"); });
    expect(updateProtection).not.toHaveBeenCalled();
  });

  it("same-tenant account switch: old-authority data is hidden synchronously and retained invocations no-op", async () => {
    const A = car("vA", "GJ01AB1234");
    findVehicle.mockResolvedValue(A);
    getProtections.mockResolvedValue([prot("p1", "vA")]);
    let r!: ReactTestRenderer;
    await act(async () => { r = create(createElement(VehicleLookupPage)); });
    await search(r, "GJ01AB1234");
    expect(allText(r)).toContain("Paint protection film"); // loaded under account a1
    const retained = retainOnCorrect(r);
    await act(async () => {
      authValue = { user: { uid: "a2" }, claims: { role: "admin", tenantId: "t", studioId: null }, loading: false }; // same tenant, different account
      r.update(createElement(VehicleLookupPage));
    });
    // Old-authority data is INVISIBLE immediately - a fresh click cannot arm on it.
    expect(allText(r)).not.toContain("Paint protection film");
    expect(allText(r)).toContain("Type a number plate to start");
    await act(async () => { retained(A, prot("p1", "vA"), draft, "vA|t|o-vA|a1|t||admin|ready|2"); });
    expect(updateProtection).not.toHaveBeenCalled();
  });

  it("owner change on the same car: a retained invocation naming the old owner no-ops", async () => {
    const A = car("vA", "GJ01AB1234");
    const Amoved = { ...A, ownerId: "o-new" } as Vehicle;
    findVehicle.mockResolvedValue(A);
    getProtections.mockResolvedValue([prot("p1", "vA")]);
    let r!: ReactTestRenderer;
    await act(async () => { r = create(createElement(VehicleLookupPage)); });
    await search(r, "GJ01AB1234");
    const retained = retainOnCorrect(r);
    findVehicle.mockResolvedValue(Amoved);
    await search(r, "GJ01AB1234"); // re-search: same id, new owner
    await act(async () => { retained(A, prot("p1", "vA"), draft, "vA|t|o-vA|a1|t||admin|ready|2"); });
    expect(updateProtection).not.toHaveBeenCalled();
  });

  it("full-target equality: owner gate isolated with the REAL invocation identity (contrast pair)", async () => {
    const A = car("vA", "GJ01AB1234");
    findVehicle.mockResolvedValue(A);
    getProtections.mockResolvedValue([prot("p1", "vA")]);
    updateProtection.mockResolvedValue(undefined);
    let r!: ReactTestRenderer;
    await act(async () => { r = create(createElement(VehicleLookupPage)); });
    await search(r, "GJ01AB1234");
    const retained = retainOnCorrect(r);
    // The real current identity for this exact state: one search from mount
    // (epoch 1), first authority generation (0), ready fingerprint - so ONLY
    // the named owner gate can explain the refusal in the second half.
    const realFp = "vA|t|o-vA|a1|t||admin|ready#0|1";
    // Matching owner: passes every gate and reaches the service.
    await act(async () => { retained(A, prot("p1", "vA"), draft, realFp); });
    expect(updateProtection).toHaveBeenCalledTimes(1);
    // Identical invocation, record owned by someone else: the owner gate
    // alone refuses it.
    await act(async () => { retained(A, prot("p1", "vA", { customerId: "someone-else" }), draft, realFp); });
    expect(updateProtection).toHaveBeenCalledTimes(1);
  });

  it("ready->verifying->ready: previously loaded data stays unavailable until a fresh search", async () => {
    const A = car("vA", "GJ01AB1234");
    findVehicle.mockResolvedValue(A);
    getProtections.mockResolvedValue([prot("p1", "vA")]);
    let r!: ReactTestRenderer;
    await act(async () => { r = create(createElement(VehicleLookupPage)); });
    await search(r, "GJ01AB1234");
    expect(allText(r)).toContain("Paint protection film");
    // Verification round trip with the IDENTICAL account/claims: the string
    // fingerprint repeats, but the authority generation must move on.
    await act(async () => { authValue = { ...authValue, loading: true }; r.update(createElement(VehicleLookupPage)); });
    await act(async () => {
      authValue = { user: { uid: "a1" }, claims: { role: "admin", tenantId: "t", studioId: null }, loading: false };
      r.update(createElement(VehicleLookupPage));
    });
    expect(allText(r)).not.toContain("Paint protection film");
    expect(allText(r)).not.toContain("Garware");
    // A fresh search under the new generation restores the data.
    await search(r, "GJ01AB1234");
    expect(allText(r)).toContain("Paint protection film");
  });

  it("retained fleet pick from an earlier selection generation publishes nothing", async () => {
    const A = car("vA", "GJ01AB1234");
    const B = car("vB", "GJ02CD5678");
    findVehicle.mockImplementation((_t: string, plate: string) => Promise.resolve(plate.includes("AB") ? A : B));
    getProtections.mockImplementation((_t: string, vid: string) => Promise.resolve([prot("p1", vid)]));
    let r!: ReactTestRenderer;
    await act(async () => { r = create(createElement(VehicleLookupPage)); });
    await search(r, "GJ01AB1234");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstPick = r.root.findByProps({ today: "2026-10-31" } as never).props.onPick as (v: any) => void;
    await search(r, "GJ02CD5678");
    await search(r, "GJ01AB1234"); // back to A: same car, but the selection moved
    const readsBefore = getProtections.mock.calls.length;
    await act(async () => { firstPick(A); });
    expect(getProtections.mock.calls.length).toBe(readsBefore); // no new read, no re-arm
    expect(allText(r)).toContain("Paint protection film"); // the current A view is untouched
  });

  it("a CURRENT fleet pick invoked while the account is verifying publishes nothing (entry gate isolated)", async () => {
    const A = car("vA", "GJ01AB1234");
    findVehicle.mockResolvedValue(A);
    getProtections.mockResolvedValue([prot("p1", "vA")]);
    let r!: ReactTestRenderer;
    await act(async () => { r = create(createElement(VehicleLookupPage)); });
    await search(r, "GJ01AB1234");
    await act(async () => { authValue = { ...authValue, loading: true }; r.update(createElement(VehicleLookupPage)); });
    // Captured AFTER the verifying render: its generation/epoch are current,
    // so only the affirmable-auth entry gate can refuse it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentPick = r.root.findByProps({ today: "2026-10-31" } as never).props.onPick as (v: any) => void;
    const readsBefore = getProtections.mock.calls.length;
    await act(async () => { currentPick(A); });
    expect(getProtections.mock.calls.length).toBe(readsBefore);
  });

  it("fleet listener lease: after StrictMode re-subscribe, the OLD subscription callback is dead, the live one publishes", async () => {
    const A = car("vA", "GJ01AB1234");
    const { StrictMode } = await import("react");
    let r!: ReactTestRenderer;
    await act(async () => { r = create(createElement(StrictMode, null, createElement(VehicleLookupPage))); });
    // setup -> cleanup -> setup: two subscriptions, identical generation, so
    // only the per-subscription lease flag can explain the drop.
    expect(listenFleet.mock.calls.length).toBe(2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oldCb = listenFleet.mock.calls[0]![1] as (v: any[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const liveCb = listenFleet.mock.calls[1]![1] as (v: any[]) => void;
    await act(async () => { oldCb([A]); });
    expect(allText(r)).not.toContain("GJ01AB1234");
    await act(async () => { liveCb([A]); });
    expect(allText(r)).toContain("GJ01AB1234");
  });

  it("StrictMode effect replay re-arms mounted: search still publishes", async () => {
    const A = car("vA", "GJ01AB1234");
    findVehicle.mockResolvedValue(A);
    getProtections.mockResolvedValue([prot("p1", "vA")]);
    let r!: ReactTestRenderer;
    const { StrictMode } = await import("react");
    await act(async () => { r = create(createElement(StrictMode, null, createElement(VehicleLookupPage))); });
    await search(r, "GJ01AB1234");
    expect(allText(r)).toContain("GJ01AB1234");
    expect(allText(r)).toContain("Paint protection film");
  });

  it("authority change: a late result from the OLD tenant never publishes into the new account", async () => {
    const A = car("vA", "GJ01AB1234");
    let resolveA!: (v: Vehicle) => void;
    findVehicle.mockImplementation((_t: string, plate: string) =>
      plate.includes("AB") ? new Promise<Vehicle>((res) => { resolveA = res; }) : Promise.resolve(null));
    let r!: ReactTestRenderer;
    await act(async () => { r = create(createElement(VehicleLookupPage)); });
    await search(r, "GJ01AB1234"); // in flight under tenant t
    await act(async () => {
      authValue = { user: { uid: "a2" }, claims: { role: "admin", tenantId: "t2", studioId: null }, loading: false };
      r.update(createElement(VehicleLookupPage));
    });
    await act(async () => { resolveA(A); }); // old-tenant result lands late
    expect(allText(r)).not.toContain("GJ01AB1234");
    expect(allText(r)).toContain("Type a number plate to start");
  });
});
