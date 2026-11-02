import type * as ProtectionService from "../../../lib/protection-service";
import type * as PaperService2 from "../../../lib/paper-service";
// Mounted-screen proof for the protection editor orchestration: the REAL
// VehicleDetailScreen rendered through react-test-renderer (react-native-web
// alias), with only the IO seams mocked (firestore, auth, services, router).
// Settles the wiring the helper tests cannot: StrictMode mount cycle,
// ready-to-ready identity change, route change, busy behavior, inert fields,
// and the unknown-ack read-back, all against the actual screen.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { create, act, type ReactTestRenderer } from "react-test-renderer";
import { createElement, StrictMode } from "react";
import { TextInput } from "react-native";
import { __params } from "../../../../test/stubs/expo-router";

const h = vi.hoisted(() => {
  const d = <T,>() => { let resolve!: (v: T) => void, reject!: (e: unknown) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };
  return {
    auth: { status: "ready", user: { uid: "me" }, claims: { tenantId: "t", role: "customer" } } as Record<string, unknown>,
    vehicleCb: null as null | ((snap: unknown) => void),
    protectionsCb: null as null | ((list: unknown[]) => void),
    createMyProtection: vi.fn(),
    updateMyProtection: vi.fn(),
    getDocFromServer: vi.fn(),
    d,
  };
});

// react-native-web's TextInput effect touches `document`, which the node
// render environment does not have. A host-element stand-in keeps the
// editable/disabled props assertable without pulling in a DOM dependency.
vi.mock("react-native", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, TextInput: (props: Record<string, unknown>) => createElement("TextInput", props) };
});
vi.mock("firebase/firestore", () => ({
  doc: (...parts: string[]) => ({ path: parts.join("/") }),
  onSnapshot: (_ref: unknown, _opts: unknown, cb: (snap: unknown) => void) => { h.vehicleCb = cb; return () => {}; },
  getDocFromServer: (...args: unknown[]) => h.getDocFromServer(...args),
}));
vi.mock("expo/fetch", () => ({ fetch: vi.fn() }));
vi.mock("expo-image-picker", () => ({ launchImageLibraryAsync: vi.fn(), requestMediaLibraryPermissionsAsync: vi.fn(), MediaTypeOptions: { Images: "Images" } }));
vi.mock("../../../lib/firebase", () => ({ db: {}, functions: {}, emulatorBackend: false }));
vi.mock("../../../hooks/useAuth", () => ({ useAuth: () => h.auth }));
vi.mock("../../../lib/vehicle-service", () => ({
  updateVehicle: vi.fn(), archiveVehicle: vi.fn(), uploadVehiclePhoto: vi.fn(), uploadVehicleRc: vi.fn(), removeVehicleImage: vi.fn(),
  resolveVehiclePhotoUrl: vi.fn(async () => { throw new Error("no photo"); }),
}));
vi.mock("../../../lib/metrics", () => ({ metrics: { heroTall: 200, heroCompact: 120 } }));
vi.mock("../../../lib/job-service", () => ({ listenToJobsForVehicle: () => () => {} }));
vi.mock("../../../lib/protection-service", async (importOriginal) => {
  const actual = await importOriginal<typeof ProtectionService>();
  return {
    ...actual,
    listenToVehicleProtections: (_id: string, _t: string, _c: string, onData: (l: unknown[]) => void) => { h.protectionsCb = onData; return () => {}; },
    createMyProtection: (...args: unknown[]) => h.createMyProtection(...args),
    updateMyProtection: (...args: unknown[]) => h.updateMyProtection(...args),
  };
});
vi.mock("../../../lib/warranty-service", () => ({ listenToVehicleWarranties: () => () => {} }));
vi.mock("../../../lib/paper-service", async (importOriginal) => {
  const actual = await importOriginal<typeof PaperService2>();
  return { ...actual, listenToVehiclePapers: () => () => {}, listenToCustomerPapers: () => () => {}, submitMyPaper: vi.fn(), updateMyPaper: vi.fn(), deleteMyPaper: vi.fn(), resolvePaperEvidenceUrl: vi.fn(async () => ({ url: null, failure: null })) };
});
vi.mock("../../../lib/invoice-service", () => ({ listenToInvoicesForVehicle: () => () => {} }));
vi.mock("../../../lib/catalogue-service", () => ({ getServiceCatalogue: vi.fn(async () => []) }));
vi.mock("../../../lib/booking-service", () => ({ getMyBookings: vi.fn(async () => []) }));
vi.mock("../../../lib/dev-detail-loader", () => ({ devGarageDetail: undefined }));

import VehicleDetailScreen from "./[id]";

const vehicle = { id: "v1", tenantId: "t", ownerId: "me", registrationNumber: "GJ01AB1234", make: "Honda", model: "City", year: "2022", color: "White", category: null, photoUrl: null, deletedAt: null, createdAt: "c", updatedAt: "u" };
const existingProt = { id: "p1", tenantId: "t", vehicleId: "v1", customerId: "me", kind: "ppf", status: "unverified", source: "customer", provider: "XPEL", warrantyYears: 5, startDate: null, notes: null, revision: 3, createdAt: "c", updatedAt: "u3" };

function textOf(el: ReactTestRenderer): string {
  const walk = (n: unknown): string => {
    if (n === null || n === undefined || typeof n === "boolean") return "";
    if (typeof n === "string") return n;
    if (Array.isArray(n)) return n.map(walk).join(" ");
    return walk((n as { children?: unknown }).children);
  };
  return walk(el.toJSON()).replace(/\s+/g, " ").trim();
}

async function mount(strict = false) {
  let el!: ReactTestRenderer;
  await act(async () => { el = create(strict ? createElement(StrictMode, null, createElement(VehicleDetailScreen)) : createElement(VehicleDetailScreen)); });
  await act(async () => {
    h.vehicleCb?.({ exists: () => true, id: "v1", data: () => vehicle, metadata: { fromCache: false, hasPendingWrites: false } });
    h.protectionsCb?.([existingProt]);
    await Promise.resolve();
  });
  return el!;
}
function press(el: ReactTestRenderer, label: string) {
  const node = el.root.findAll((n) => n.props?.label === label && typeof n.props?.onPress === "function")[0];
  if (!node) throw new Error(`no pressable labelled ${label}`);
  node.props.onPress();
}
const editorOpen = (el: ReactTestRenderer) => textOf(el).includes("Marked as added by you");

beforeEach(() => {
  (globalThis as Record<string, unknown>).__DEV__ = false;
  __params.current = { id: "v1" };
  h.auth = { status: "ready", user: { uid: "me" }, claims: { tenantId: "t", role: "customer" } };
  h.vehicleCb = null; h.protectionsCb = null;
  h.createMyProtection.mockReset(); h.updateMyProtection.mockReset(); h.getDocFromServer.mockReset();
});

describe("mounted protection editor orchestration", () => {
  it("superseded records render as HISTORY with end provenance - never current, never editable, no add affordances", async () => {
    const el = await mount();
    act(() => { h.protectionsCb?.([
      existingProt,
      { ...existingProt, id: "p2", kind: "ceramic", lifecycle: "superseded", lifecycleAt: "2026-10-20", supersededByJobId: "j9" },
    ]); });
    const text = textOf(el);
    expect(text).toContain("Reported by you");
    expect(text).toContain("Protection history");
    expect(text).toContain("Replaced by newer work · 20 Oct 2026");
    expect(text).toContain("Past record");
    // The superseded record keeps no edit affordance even though it is own,
    // self-declared and unverified - only the current PPF row is editable.
    const edits = el.root.findAll((n) => typeof n.props?.label === "string" && n.props.label.startsWith("Edit ") && typeof n.props?.onPress === "function").map((n) => n.props.label as string);
    expect(edits.filter((l) => l.includes("Paint Protection Film"))).toEqual(["Edit Paint Protection Film"]);
    expect(edits.some((l) => l.includes("Ceramic"))).toBe(false);
    // The self-report ADD UI is removed (2 Nov basket, item 11): no add
    // affordances remain for any kind, current or superseded.
    expect(text).not.toContain("Add ceramic coating");
    expect(text).not.toContain("Add PPF");
    // History rows link out to the car's service history, not to a fabricated
    // per-job screen.
    expect(text).toContain("View service history");
  });

  it("a REMOVED current record leaves the current lists entirely and stays history-only (no re-add UI)", async () => {
    const el = await mount();
    act(() => { h.protectionsCb?.([
      { ...existingProt, lifecycle: "removed", lifecycleAt: "2026-10-21", removedByJobId: "j8" },
    ]); });
    const text = textOf(el);
    expect(text).toContain("Protection history");
    expect(text).toContain("Removed · 21 Oct 2026");
    expect(text).not.toContain("Edit Paint Protection Film"); // history is never editable
    expect(text).not.toContain("Add PPF"); // ADD UI removed (2 Nov basket, item 11)
    expect(text).not.toContain("Add ceramic coating");
  });

  it("StrictMode mount cycle: the flow survives the probe cleanup and a save still closes the editor", async () => {
    const el = await mount(true);
    await act(async () => { press(el, "Edit Paint Protection Film"); });
    expect(editorOpen(el)).toBe(true);
    h.updateMyProtection.mockResolvedValue({});
    h.getDocFromServer.mockResolvedValue({ exists: () => true, id: "p1", data: () => ({ ...existingProt, revision: 4, updatedAt: "u4" }) });
    await act(async () => { press(el, "Save"); await Promise.resolve(); });
    expect(h.updateMyProtection).toHaveBeenCalledTimes(1);
    expect(editorOpen(el)).toBe(false);
  });

  it("occurrence guard: the reported-by-you section and each record render EXACTLY ONCE (anti-stacking)", async () => {
    const el = await mount();
    const text = textOf(el);
    const count = (needle: string) => text.split(needle).length - 1;
    expect(count("Reported by you")).toBe(1);
    expect(count("Paint Protection Film")).toBe(1);
    expect(count("Added by you")).toBe(1);
  });

  it("contract: the self-report ADD UI and the customer Warranty section are hidden (2 Nov basket, item 11 + 15:45:51)", async () => {
    const el = await mount();
    const text = textOf(el);
    expect(text).not.toContain("Add PPF");
    expect(text).not.toContain("Add ceramic coating");
    // Warranty certificates section hidden from the customer Garage. Records
    // and issuance are untouched - only the render is gone (flagged constant).
    expect(text).not.toContain("certificate");
    expect(text).not.toContain("Warranties are issued automatically");
    // Reported records stay visible and editable.
    expect(text).toContain("Reported by you");
    const edits = el.root.findAll((n) => typeof n.props?.label === "string" && n.props.label.startsWith("Edit ") && typeof n.props?.onPress === "function").map((n) => n.props.label as string);
    expect(edits).toContain("Edit Paint Protection Film");
  });

  it("busy in-flight: fields go inert (editable=false) and a second Save does not double-call", async () => {
    const el = await mount();
    await act(async () => { press(el, "Edit Paint Protection Film"); });
    const d = h.d<unknown>();
    h.updateMyProtection.mockReturnValue(d.promise);
    h.getDocFromServer.mockReturnValue(new Promise(() => {}));
    await act(async () => { press(el, "Save"); });
    const inputs = el.root.findAllByType(TextInput).filter((n) => n.props.editable === false);
    expect(inputs.length).toBeGreaterThanOrEqual(3); // brand, years, notes
    const dateInputs = el.root.findAll((n) => n.type === "input" && n.props?.disabled === true);
    expect(dateInputs.length).toBeGreaterThanOrEqual(1); // the DateField web input is disabled too
    await act(async () => { press(el, "Save"); }); // guard: busy
    expect(h.updateMyProtection).toHaveBeenCalledTimes(1);
    await act(async () => { d.resolve({}); await Promise.resolve(); });
  });

  it("ready-to-ready account change during an in-flight save closes the editor synchronously and the late resolve publishes nothing", async () => {
    const el = await mount();
    await act(async () => { press(el, "Edit Paint Protection Film"); });
    const d = h.d<unknown>();
    h.updateMyProtection.mockReturnValue(d.promise);
    h.getDocFromServer.mockReturnValue(new Promise(() => {}));
    await act(async () => { press(el, "Save"); });
    expect(editorOpen(el)).toBe(true);
    // Same status "ready", different identity: the render-time invalidation must fire.
    h.auth = { status: "ready", user: { uid: "someone-else" }, claims: { tenantId: "t", role: "customer" } };
    await act(async () => { el.update(createElement(VehicleDetailScreen)); });
    expect(editorOpen(el)).toBe(false);
    await act(async () => { d.resolve({}); await Promise.resolve(); });
    expect(editorOpen(el)).toBe(false);
    expect(textOf(el)).not.toContain("Could not confirm the save");
  });

  it("route change to another car closes the old car's editor before any effect could run", async () => {
    const el = await mount();
    await act(async () => { press(el, "Edit Paint Protection Film"); });
    expect(editorOpen(el)).toBe(true);
    __params.current = { id: "v2" };
    await act(async () => { el.update(createElement(VehicleDetailScreen)); });
    expect(editorOpen(el)).toBe(false);
  });

  it("unknown-ack edit: confirmed server read-back upserts the list, closes the editor, and says the latest is now shown", async () => {
    const el = await mount();
    // accepted edit-row label from PROTECTION_KIND_LABELS, asserted by the gating-aware lineage (0391).
    await act(async () => { press(el, "Edit Paint Protection Film"); });
    expect(editorOpen(el)).toBe(true);
    h.updateMyProtection.mockRejectedValue(Object.assign(new Error("conflict"), { code: "functions/failed-precondition" }));
    h.getDocFromServer.mockResolvedValue({ exists: () => true, id: "p1", data: () => ({ ...existingProt, provider: "STEK", revision: 4, updatedAt: "u4" }) });
    await act(async () => { press(el, "Save"); await Promise.resolve(); await Promise.resolve(); });
    expect(editorOpen(el)).toBe(false);
    expect(textOf(el)).toContain("latest saved version is now shown");
    expect(textOf(el)).toContain("STEK");
  });

  it("offline read-back keeps the draft open and never claims the display is current", async () => {
    const el = await mount();
    // accepted edit-row label from PROTECTION_KIND_LABELS, asserted by the gating-aware lineage (0391).
    await act(async () => { press(el, "Edit Paint Protection Film"); });
    h.updateMyProtection.mockRejectedValue(Object.assign(new Error("down"), { code: "functions/unavailable" }));
    h.getDocFromServer.mockRejectedValue(new Error("offline"));
    await act(async () => { press(el, "Save"); await Promise.resolve(); await Promise.resolve(); });
    expect(editorOpen(el)).toBe(true);
    expect(textOf(el)).toContain("could not be loaded right now");
  });
});
