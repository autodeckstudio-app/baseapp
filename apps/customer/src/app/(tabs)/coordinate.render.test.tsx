import React, { useEffect } from "react";
import { it, expect, vi, beforeEach } from "vitest";
import { create, act } from "react-test-renderer";
import { TextInput } from "react-native";
vi.mock("react-native", async () => ({
  ...(await vi.importActual<any>("react-native")),
  TextInput: "TextInput",
}));
const h = vi.hoisted(() => ({
  owner: "a",
  vehicle: "car",
  params: { services: "wash,coat" },
  seq: 0,
  list: vi.fn(),
  send: vi.fn(),
  withdraw: vi.fn(),
}));
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => h.params,
  useRouter: () => ({ push: vi.fn(), navigate: vi.fn() }),
  useFocusEffect: (fn: any) => useEffect(fn, [fn]),
}));
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    status: "ready",
    user: { uid: h.owner },
    customerDocId: h.owner,
    claims: { tenantId: "tenant" },
  }),
}));
vi.mock("../../lib/vehicle-size", () => ({
  usePricingVehicle: () => ({
    vehicle: h.vehicle ? { id: h.vehicle, make: "Sample", model: "Car" } : null,
  }),
}));
vi.mock("../../lib/catalogue-service", () => ({
  getServiceCatalogue: async () =>
    ["wash", "coat", "extra1", "extra2", "extra3"].map((id, i) => ({
      id,
      name: id,
      category: i ? "detailing" : "washing",
      active: true,
      basePrice: 10000,
      estimatedDurationMinutes: 60,
      requiredBayType: i ? "protection" : "wash",
    })),
}));
vi.mock("../../lib/visit-coordination", () => ({
  coordinationOperationId: () => `operation-${++h.seq}`,
  getVisitCoordinationRequests: (...args: any[]) => h.list(...args),
  requestVisitCoordination: (...args: any[]) => h.send(...args),
  withdrawVisitCoordinationRequest: (...args: any[]) => h.withdraw(...args),
}));
vi.mock("../../ui/kit", () => ({
  Screen: "Screen",
  T: "T",
  Button: "Button",
  Notice: "Notice",
  Pane: "Pane",
}));
import Page from "./coordinate";
const row = {
  id: "request",
  vehicleId: "car",
  lines: [
    { serviceId: "wash", name: "wash" },
    { serviceId: "coat", name: "coat" },
  ],
  status: "requested",
  version: 1,
  vehicleLabel: "Sample Car",
};
const text = (r: any) => JSON.stringify(r.toJSON());
const button = (r: any, label: string) =>
  r.root.findAllByType("Button").find((x: any) => x.props.label === label);
beforeEach(() => {
  h.owner = "a";
  h.vehicle = "car";
  h.params = { services: "wash,coat" };
  h.list.mockReset().mockResolvedValue({ requests: [], nextCursor: null });
  h.send.mockReset().mockResolvedValue(row);
  h.withdraw
    .mockReset()
    .mockResolvedValue({ ...row, status: "withdrawn", version: 2 });
});
it("sends exact services and selected car with no client prices or dates, then shows receipt", async () => {
  let r: any;
  await act(async () => {
    r = create(<Page />);
  });
  expect(button(r, "Send visit request").props.disabled).toBe(false);
  await act(async () => button(r, "Send visit request").props.onPress());
  expect(h.send.mock.calls[0]![0]).toMatchObject({
    vehicleId: "car",
    serviceIds: ["wash", "coat"],
  });
  expect(Object.keys(h.send.mock.calls[0]![0]).sort()).toEqual([
    "notes",
    "operationId",
    "serviceIds",
    "studioId",
    "vehicleId",
  ]);
  expect(text(r)).toContain("Request received");
  expect(button(r, "Send visit request")).toBeUndefined();
  await act(async () => r.unmount());
});
it("does not submit without a car or with invalid selection", async () => {
  h.vehicle = "";
  let r: any;
  await act(async () => {
    r = create(<Page />);
  });
  expect(button(r, "Send visit request").props.disabled).toBe(true);
  h.vehicle = "car";
  h.params.services = "wash,missing";
  await act(async () => r.update(<Page />));
  expect(button(r, "Send visit request").props.disabled).toBe(true);
  expect(h.send).not.toHaveBeenCalled();
  await act(async () => r.unmount());
});
it("accepts all five selected IDs, not only the four-extras parser", async () => {
  h.params.services = "wash,coat,extra1,extra2,extra3";
  let r: any;
  await act(async () => {
    r = create(<Page />);
  });
  expect(button(r, "Send visit request").props.disabled).toBe(false);
  await act(async () => button(r, "Send visit request").props.onPress());
  expect(h.send.mock.calls[0]![0].serviceIds).toHaveLength(5);
  await act(async () => r.unmount());
});
it("retry uses unchanged operation and content after an unknown outcome", async () => {
  h.send.mockRejectedValueOnce(Error("unknown"));
  let r: any;
  await act(async () => {
    r = create(<Page />);
  });
  await act(async () => button(r, "Send visit request").props.onPress());
  expect(text(r)).toContain("not confirmed");
  expect(r.root.findByType(TextInput).props.editable).toBe(false);
  await act(async () => button(r, "Send visit request").props.onPress());
  expect(h.send.mock.calls[1]![0]).toEqual(h.send.mock.calls[0]![0]);
  await act(async () => r.unmount());
});
it("recovered matching live request suppresses duplicate submission on return", async () => {
  h.list.mockResolvedValue({ requests: [row], nextCursor: null });
  let r: any;
  await act(async () => {
    r = create(<Page />);
  });
  expect(button(r, "Send visit request")).toBeUndefined();
  expect(text(r)).toContain("Awaiting studio reply");
  await act(async () => button(r, "Withdraw request").props.onPress());
  expect(h.withdraw).toHaveBeenCalled();
  expect(text(r)).toContain("Withdrawn");
  await act(async () => r.unmount());
});
it("failed read hides stale actions and permits a refresh", async () => {
  h.list.mockRejectedValueOnce(Error("offline"));
  let r: any;
  await act(async () => {
    r = create(<Page />);
  });
  expect(button(r, "Send visit request").props.disabled).toBe(true);
  await act(async () => button(r, "Refresh requests").props.onPress());
  expect(button(r, "Send visit request").props.disabled).toBe(false);
  await act(async () => r.unmount());
});
it("late send result cannot enter a different owner scope", async () => {
  let resolve: any;
  h.send.mockImplementation(() => new Promise((r) => (resolve = r)));
  let r: any;
  await act(async () => {
    r = create(<Page />);
  });
  act(() => {
    button(r, "Send visit request").props.onPress();
  });
  h.owner = "b";
  await act(async () => r.update(<Page />));
  await act(async () => resolve({ ...row, vehicleLabel: "PRIVATE OLD OWNER" }));
  expect(text(r)).not.toContain("PRIVATE OLD OWNER");
  await act(async () => r.unmount());
});
it('old A-owner send cannot return after A-B-A identity changes',async()=>{let resolve:any;h.send.mockImplementation(()=>new Promise(r=>resolve=r));let r:any;await act(async()=>{r=create(<Page/>)});act(()=>{button(r,'Send visit request').props.onPress()});h.owner='b';await act(async()=>r.update(<Page/>));h.owner='a';await act(async()=>r.update(<Page/>));expect(button(r,'Send visit request').props.disabled).toBe(false);await act(async()=>resolve({...row,vehicleLabel:'PRIVATE OLD A RESPONSE'}));expect(text(r)).not.toContain('PRIVATE OLD A RESPONSE');expect(button(r,'Send visit request')).toBeDefined();await act(async()=>r.unmount())});
