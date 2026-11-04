// Regression: a claim-pending session (claims present, customerDocId null)
// must resolve the designed empty model - before the fix, every effect bailed
// on !uid, vehicles stayed null, and Home hung on the skeleton forever.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { create, act } from "react-test-renderer";
import React, { createElement } from "react";

type Listener = (...args: unknown[]) => () => void;
const h = vi.hoisted(() => ({
  listenToMyVehicles: vi.fn<Listener>(() => () => {}),
  listenToMyJobs: vi.fn<Listener>(() => () => {}),
  listenToMyPendingApprovals: vi.fn<Listener>(() => () => {}),
  listenToMyIssuedInvoices: vi.fn<Listener>(() => () => {}),
  listenToMyMemberships: vi.fn<Listener>(() => () => {}),
  listenToVehicleProtections: vi.fn<Listener>(() => () => {}),
  getMyBookings: vi.fn<() => Promise<unknown[]>>(async () => []),
  project: vi.fn((input: { vehicles: unknown[] }) => ({ heroState: input.vehicles.length ? "active" : "empty" })),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: async () => null, setItem: async () => {} },
}));
vi.mock("../lib/vehicle-service", () => ({ listenToMyVehicles: h.listenToMyVehicles }));
vi.mock("../lib/booking-service", () => ({ getMyBookings: h.getMyBookings }));
vi.mock("../lib/protection-service", () => ({ listenToVehicleProtections: h.listenToVehicleProtections }));
vi.mock("../lib/home-service", () => ({
  listenToMyJobs: h.listenToMyJobs,
  listenToMyPendingApprovals: h.listenToMyPendingApprovals,
  listenToMyIssuedInvoices: h.listenToMyIssuedInvoices,
  listenToMyMemberships: h.listenToMyMemberships,
}));
vi.mock("@autodeck/core", () => ({
  projectCustomerHome: (input: unknown) => h.project(input as { vehicles: unknown[] }),
}));

import { useCustomerHome } from "./useCustomerHome";

let last: { model: unknown; error: string | null };
function Probe(props: { uid: string | null; tenantId: string | null }) {
  last = useCustomerHome(props.uid, props.tenantId) as typeof last;
  return null;
}
let renderer: ReturnType<typeof create>;
async function mount(uid: string | null, tenantId: string | null) {
  await act(async () => {
    renderer = create(createElement(Probe, { uid, tenantId }));
  });
}
afterEach(async () => {
  try { await act(async () => { renderer?.unmount(); }); } catch { /* already gone */ }
});
beforeEach(() => {
  vi.clearAllMocks();
  h.getMyBookings.mockResolvedValue([]);
  last = { model: undefined, error: null };
});

describe("useCustomerHome claim-pending guard", () => {
  it("resolves the empty model with no customer doc, never a skeleton hang", async () => {
    await mount(null, "automodz");
    expect(last.model).not.toBeNull();
    expect((last.model as { heroState: string }).heroState).toBe("empty");
    expect(last.error).toBeNull();
    expect(h.listenToMyVehicles).not.toHaveBeenCalled();
    expect(h.getMyBookings).not.toHaveBeenCalled();
  });

  it("keeps the normal listener path once a customer doc exists", async () => {
    const deliverEmpty: Listener = (...args: unknown[]) => { (args[2] as (v: unknown[]) => void)([]); return () => {}; };
    h.listenToMyVehicles.mockImplementation(deliverEmpty);
    h.listenToMyJobs.mockImplementation(deliverEmpty);
    h.listenToMyPendingApprovals.mockImplementation(deliverEmpty);
    h.listenToMyIssuedInvoices.mockImplementation(deliverEmpty);
    h.listenToMyMemberships.mockImplementation(deliverEmpty);
    await mount("cust-1", "automodz");
    expect(h.listenToMyVehicles).toHaveBeenCalledWith("cust-1", "automodz", expect.any(Function), expect.any(Function));
    expect(last.model).not.toBeNull();
  });
});
