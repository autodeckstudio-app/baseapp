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

vi.mock("./useForegroundRefresh",()=>({useForegroundRefresh:()=>{},useForegroundNow:()=>Date.now()}));
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

it('clears prior account model and ignores late listeners and errors after same-ready account switch',async()=>{
 const old:Record<string,any>={};const next:Record<string,any>={};const callbacks=(kind:string)=>(...args:any[])=>{(args[0]==='cust-old'||args[1]==='cust-old'?old:next)[kind]={ok:args[2],error:args[3]};return()=>{}};
 h.listenToMyVehicles.mockImplementation(callbacks('cars'));h.listenToMyJobs.mockImplementation(callbacks('jobs'));h.listenToMyPendingApprovals.mockImplementation(callbacks('approvals'));h.listenToMyIssuedInvoices.mockImplementation(callbacks('invoices'));h.listenToMyMemberships.mockImplementation(callbacks('memberships'));
 await mount('cust-old','t');await act(async()=>{old.cars.ok([{id:'private'}]);old.jobs.ok([]);old.approvals.ok([]);old.invoices.ok([]);old.memberships.ok([])});expect(last.model).not.toBeNull();
 await act(async()=>renderer.update(createElement(Probe,{uid:'cust-next',tenantId:'t'})));expect(last.model).toBeNull();await act(async()=>{old.cars.ok([{id:'PRIVATE-OLD'}]);old.jobs.ok([{id:'PRIVATE-JOB'}]);old.cars.error(new Error('PRIVATE-ERROR'))});expect(last.model).toBeNull();expect(last.error).toBeNull();
 await act(async()=>{next.cars.ok([]);next.jobs.ok([]);next.approvals.ok([]);next.invoices.ok([]);next.memberships.ok([])});expect(last.model).not.toBeNull();expect(h.project.mock.lastCall?.[0].vehicles).toEqual([]);
});

it('passes live issued invoices into the model and reprojects when only invoices change',async()=>{
 const callbacks:Record<string,any>={};const bind=(kind:string)=>(...args:any[])=>{callbacks[kind]=args[2];return()=>{}};
 h.listenToMyVehicles.mockImplementation(bind('cars'));h.listenToMyJobs.mockImplementation(bind('jobs'));h.listenToMyPendingApprovals.mockImplementation(bind('approvals'));h.listenToMyIssuedInvoices.mockImplementation(bind('invoices'));h.listenToMyMemberships.mockImplementation(bind('memberships'));
 await mount('invoice-owner','invoice-tenant');await act(async()=>{callbacks.cars([{id:'car-a'}]);callbacks.jobs([]);callbacks.approvals([]);callbacks.invoices([]);callbacks.memberships([])});
 const issued={id:'invoice-a',vehicleId:'car-a',status:'issued'};await act(async()=>callbacks.invoices([issued]));expect(h.project.mock.lastCall?.[0]).toMatchObject({invoices:[issued]});
 await act(async()=>callbacks.invoices([]));expect(h.project.mock.lastCall?.[0]).toMatchObject({invoices:[]});
});

it('changes the canonical preferred vehicle immediately, rejects non-owned IDs and ignores deleted cars',async()=>{
 const callbacks:Record<string,any>={};const bind=(kind:string)=>(...args:any[])=>{callbacks[kind]=args[2];return()=>{}};
 h.listenToMyVehicles.mockImplementation(bind('cars'));h.listenToMyJobs.mockImplementation(bind('jobs'));h.listenToMyPendingApprovals.mockImplementation(bind('approvals'));h.listenToMyIssuedInvoices.mockImplementation(bind('invoices'));h.listenToMyMemberships.mockImplementation(bind('memberships'));
 await mount('owner','tenant');await act(async()=>{callbacks.cars([{id:'a',deletedAt:null},{id:'b',deletedAt:null},{id:'deleted',deletedAt:'date'}]);callbacks.jobs([]);callbacks.approvals([]);callbacks.invoices([{id:'invoice-a',vehicleId:'a'}]);callbacks.memberships([])});
 await act(async()=>{(last as any).selectVehicle('b')});expect(h.project.mock.lastCall?.[0]).toMatchObject({preferredVehicleId:'b',invoices:[{id:'invoice-a',vehicleId:'a'}]});
 for(const id of ['not-owned','deleted']){await act(async()=>{(last as any).selectVehicle(id)});expect(h.project.mock.lastCall?.[0]).toMatchObject({preferredVehicleId:'b'})}
});

it('clears a failed listener notice only when all failed sources recover',async()=>{
 const callbacks:Record<string,any>={};const bind=(kind:string)=>(...args:any[])=>{callbacks[kind]={ok:args[2],error:args[3]};return()=>{}};
 h.listenToMyVehicles.mockImplementation(bind('cars'));h.listenToMyJobs.mockImplementation(bind('jobs'));h.listenToMyPendingApprovals.mockImplementation(bind('approvals'));h.listenToMyIssuedInvoices.mockImplementation(bind('invoices'));h.listenToMyMemberships.mockImplementation(bind('memberships'));
 await mount('recovery-owner','t');await act(async()=>{callbacks.cars.ok([]);callbacks.jobs.error(new Error('offline'));callbacks.approvals.ok([]);callbacks.invoices.error(new Error('offline'));callbacks.memberships.ok([])});expect(last.error).toContain('could not load');
 await act(async()=>callbacks.jobs.ok([]));expect(last.error).toContain('could not load');await act(async()=>callbacks.invoices.ok([]));expect(last.error).toBeNull();
});
