import React, { useEffect } from "react";
import { it, expect, vi, beforeEach } from "vitest";
import { create, act } from "react-test-renderer";
import { TextInput } from "react-native";
const h = vi.hoisted(() => ({
  owner: "staff-a",
  studio: "s",
  seq: 0,
  list: vi.fn(),
  reply: vi.fn(),
}));
vi.mock("expo-router", () => ({
  useFocusEffect: (fn: any) => useEffect(fn, [fn]),
}));
vi.mock("expo-crypto", () => ({ randomUUID: () => `op-${++h.seq}` }));
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    status: "ready",
    user: { uid: h.owner },
    claims: { tenantId: "t", role: "studio", studioId: h.studio },
  }),
}));
vi.mock("../../lib/firebase", () => ({ functions: {} }));
vi.mock("firebase/functions", () => ({
  httpsCallable: (_: any, name: string) => async (body: any) => ({
    data: await (name === "getVisitCoordinationRequests"
      ? h.list(body)
      : h.reply(body)),
  }),
}));
vi.mock("@autodeck/ui", () => ({
  Button: "Button",
  colors: { textPrimary: "#111", textSecondary: "#777" },
  spacing: { xl: 24, lg: 16, md: 12 },
  radius: { lg: 12, md: 8 },
  typography: { heading: {}, title: {}, body: {} },
}));
vi.mock("react-native", async () => ({
  ...(await vi.importActual<any>("react-native")),
  TextInput: "TextInput",
}));
import Page from "./visit-requests";
const row = {
  id: "r",
  studioId: "s",
  customerId: "c",
  vehicleId: "v",
  customerName: "Sample",
  vehicleLabel: "Sample Car",
  lines: [
    { serviceId: "a", name: "Wash" },
    { serviceId: "b", name: "Ceramic" },
  ],
  status: "requested",
  version: 1,
};
const button = (r: any, label: string) =>
  r.root.findAllByType("Button").find((x: any) => x.props.label === label);
const text = (r: any) => JSON.stringify(r.toJSON());
beforeEach(() => {
  h.owner = "staff-a";
  h.studio = "s";
  h.list.mockReset().mockResolvedValue({ requests: [row], nextCursor: null });
  h.reply
    .mockReset()
    .mockImplementation(async (d) => ({
      ...row,
      status: "answered",
      version: 2,
      reply: d.reply,
    }));
});
it("loads only scoped studio and sends customer-visible response to exact version", async () => {
  let r: any;
  await act(async () => {
    r = create(<Page />);
  });
  expect(h.list).toHaveBeenCalledWith({ studioId: "s" });
  expect(button(r, "Send reply").props.disabled).toBe(true);
  await act(async () =>
    r.root
      .findByType(TextInput)
      .props.onChangeText("Contact us to discuss timing."),
  );
  await act(async () => button(r, "Send reply").props.onPress());
  expect(h.reply.mock.calls[0]![0]).toMatchObject({
    id: "r",
    expectedVersion: 1,
    action: "reply",
    reply: "Contact us to discuss timing.",
  });
  expect(text(r)).toContain("Replied");
  expect(button(r, "Send reply")).toBeUndefined();
  await act(async () => r.unmount());
});
it("unknown response retry keeps operation and visible words unchanged", async () => {
  h.reply.mockRejectedValueOnce(Error("unknown"));
  let r: any;
  await act(async () => {
    r = create(<Page />);
  });
  await act(async () =>
    r.root.findByType(TextInput).props.onChangeText("Contact us."),
  );
  await act(async () => button(r, "Send reply").props.onPress());
  expect(r.root.findByType(TextInput).props.editable).toBe(false);
  await act(async () => button(r, "Send reply").props.onPress());
  expect(h.reply.mock.calls[1]![0]).toEqual(h.reply.mock.calls[0]![0]);
  await act(async () => r.unmount());
});
it("late read cannot show another studio customer", async () => {
  let resolve: any;
  h.list.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
  let r: any;
  await act(async () => {
    r = create(<Page />);
  });
  h.studio = "other";
  await act(async () => r.update(<Page />));
  await act(async () =>
    resolve({
      requests: [{ ...row, customerName: "PRIVATE OLD STUDIO" }],
      nextCursor: null,
    }),
  );
  expect(text(r)).not.toContain("PRIVATE OLD STUDIO");
  await act(async () => r.unmount());
});
it("failed refresh hides stale response controls", async () => {
  let r: any;
  await act(async () => {
    r = create(<Page />);
  });
  h.list.mockRejectedValueOnce(Error("offline"));
  await act(async () => button(r, "Refresh requests").props.onPress());
  expect(button(r, "Send reply")).toBeUndefined();
  expect(text(r)).toContain("could not load");
  await act(async () => r.unmount());
});
it('old studio reply cannot return after A-B-A studio identity changes',async()=>{let resolve:any;h.reply.mockImplementation(()=>new Promise(r=>resolve=r));let r:any;await act(async()=>{r=create(<Page/>)});await act(async()=>r.root.findByType(TextInput).props.onChangeText('An old reply'));act(()=>{button(r,'Send reply').props.onPress()});h.studio='b';await act(async()=>r.update(<Page/>));h.studio='s';await act(async()=>r.update(<Page/>));await act(async()=>resolve({...row,status:'answered',reply:'PRIVATE OLD STUDIO RESPONSE'}));expect(text(r)).not.toContain('PRIVATE OLD STUDIO RESPONSE');expect(button(r,'Send reply')).toBeDefined();await act(async()=>r.unmount())});
