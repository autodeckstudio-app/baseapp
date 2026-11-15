// Renders the REAL DeliveryDeclarationPanel (kit Button etc. via react-native-web)
// and drives its chips, asserting the built declaration payload per interaction.
// Complements the pure builder tests in lib/protection-declaration.test.ts: this
// proves the mounted wiring - that pressing a chip is what affirms a choice and
// that nothing is pre-affirmed. Does not establish on-device rendering.
import { describe, expect, it, vi } from "vitest";
import { create, act } from "react-test-renderer";
import { createElement } from "react";
import { DeliveryDeclarationPanel } from "./DeliveryDeclarationPanel";
import type { Protection, ProtectionWorkEvent } from "@autodeck/core";

const prot = (id: string, o: Partial<Protection> = {}): Protection => ({ id, tenantId: "t", vehicleId: "v", customerId: "c", kind: "ppf", provider: "Garware", policyNumber: null, startDate: "2026-06-12", expiryDate: null, documentUrl: null, status: "unverified", source: "customer", verifiedBy: null, verifiedAt: null, notes: null, revision: 2, coverage: "full_body", createdAt: "x", updatedAt: "x", ...o });

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

/** Finds the deepest rendered node whose label text matches and that carries
 * an onPress, then presses it. Chips and kit Buttons both end here. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function press(el: any, label: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hit = el.root.findAll((n: any) => typeof n.props.onPress === "function" && textOfNode(n) === label);
  if (hit.length === 0) throw new Error(`no pressable labelled ${JSON.stringify(label)}`);
  const target = hit[hit.length - 1];
  act(() => { target.props.onPress(); });
}
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
function renderPanel(protections: Protection[], spy = vi.fn()): { el: any; spy: ReturnType<typeof vi.fn> } {
  let el!: any;
  act(() => { el = create(createElement(DeliveryDeclarationPanel, { protections, onValidChange: spy })); });
  return { el, spy };
}
const lastCall = (spy: ReturnType<typeof vi.fn>): ProtectionWorkEvent[] | null => spy.mock.calls[spy.mock.calls.length - 1]?.[0] ?? null;

describe("DeliveryDeclarationPanel mounted", () => {
  it("starts UNCHOSEN: invalid, and nothing about the booked service prefills a choice", () => {
    const { el, spy } = renderPanel([prot("p1")]);
    expect(lastCall(spy)).toBeNull();
    expect(textOf(el)).toContain("Protection work on this visit");
  });
  it("pressing 'No protection work' is the only way to get the explicit empty declaration", () => {
    const { el, spy } = renderPanel([prot("p1")]);
    press(el, "No protection work");
    expect(lastCall(spy)).toEqual([]);
  });
  it("an install builds only after the staff member affirms BOTH type and scope", () => {
    const { el, spy } = renderPanel([]);
    press(el, "Record work");
    expect(lastCall(spy)).toBeNull(); // zero events
    press(el, "Add install");
    expect(lastCall(spy)).toBeNull(); // kind + coverage unchosen
    press(el, "PPF");
    expect(lastCall(spy)).toBeNull(); // scope still unchosen
    press(el, "Full body");
    expect(lastCall(spy)).toEqual([{ action: "install", kind: "ppf", coverage: "full_body", brand: null, warrantyYears: null }]);
  });
  it("a replace freezes the target revision at selection and does NOT inherit the old brand", () => {
    const { el, spy } = renderPanel([prot("p1", { provider: "Kovalent", warrantyYears: 3 })]);
    press(el, "Record work");
    press(el, "Add replace");
    press(el, "PPF - Full body (Kovalent) - 2026-06-12 - customer entry - ref p1");
    expect(lastCall(spy)).toEqual([
      { action: "replace", targetProtectionId: "p1", expectedRevision: 2, kind: "ppf", coverage: "full_body", brand: null, warrantyYears: null },
    ]);
  });
  it("a record changing under a frozen selection turns the declaration invalid (never auto-advances)", () => {
    const spy = vi.fn();
    let el!: any;
    act(() => { el = create(createElement(DeliveryDeclarationPanel, { protections: [prot("p1")], onValidChange: spy })); });
    press(el, "Record work");
    press(el, "Add removal");
    press(el, "PPF - Full body (Garware) - 2026-06-12 - customer entry - ref p1");
    expect(lastCall(spy)).toEqual([{ action: "remove", targetProtectionId: "p1", expectedRevision: 2 }]);
    // The listener pushes a newer revision (someone else edited the record).
    act(() => { el.update(createElement(DeliveryDeclarationPanel, { protections: [prot("p1", { revision: 3 })], onValidChange: spy })); });
    expect(lastCall(spy)).toBeNull();
  });
});
