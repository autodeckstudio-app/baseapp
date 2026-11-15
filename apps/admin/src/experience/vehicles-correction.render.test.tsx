import type { ProtectionStatus } from "@autodeck/core";
// Mounts the REAL VehiclesView correction form: a correction binds to the
// FULL frozen identity (viewed car + record) captured at open, disarms
// PERMANENTLY across an A->B->A navigation, enforces the explicit scope
// election in the submit handler itself (a disabled button is not a guard),
// maps blanked fields to explicit null clears (never silent keeps), and
// gives history rows no affordance with neutral labels for malformed legacy
// lifecycle values.
import { describe, expect, it, vi } from "vitest";
import { create, act, type ReactTestRenderer } from "react-test-renderer";
import { createElement } from "react";
import type { Protection, Vehicle } from "@autodeck/core";
import { VehiclesView, COVERAGE_LABEL, type CorrectionDraft } from "./VehiclesView";

const prot = (id: string, o: Partial<Protection> = {}): Protection => ({
  id, tenantId: "t", vehicleId: "vA", customerId: "c", kind: "ppf",
  provider: "Garware", policyNumber: "P-1", startDate: "2026-06-12", expiryDate: "2031-06-12",
  documentUrl: null, status: "unverified", source: "customer", verifiedBy: null, verifiedAt: null,
  notes: "n0", revision: 2, coverage: "full_body", warrantyYears: 5,
  createdAt: "2026-06-12T00:00:00Z", updatedAt: "2026-06-13T00:00:00Z",
  ...o,
});
const carA = { id: "vA", tenantId: "t", ownerId: "c", registrationNumber: "GJ01AB1234", createdAt: "2026-01-01" } as Vehicle;
const carB = { id: "vB", tenantId: "t", ownerId: "c2", registrationNumber: "GJ02CD5678", createdAt: "2026-01-01" } as Vehicle;

type Props = {
  vehicle: Vehicle | null; protections: Protection[]; authorityKey: string;
  onCorrect: (v: Vehicle, p: Protection, d: CorrectionDraft) => void;
  onStatus: (v: Vehicle, p: Protection, s: ProtectionStatus) => void;
};
function mountProps(over: Partial<Props> = {}) {
  return {
    today: "2026-10-31", searching: false, vehicle: carA, protections: [prot("p1")], documents: [],
    error: null, message: null, fleet: [], ownerNames: {},
    onPick: () => {}, onOpenOwner: () => {}, onSearch: () => {}, onAdd: () => {},
    onStatus: () => {}, onCorrect: () => {}, authorityKey: "u1|t|", selectionKey: "1", ...over,
  };
}
function mount(over: Partial<Props> = {}) {
  let r!: ReactTestRenderer;
  act(() => { r = create(createElement(VehiclesView, mountProps(over))); });
  return r;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const textOf = (n: any): string => {
  if (n === null || n === undefined || typeof n === "boolean") return "";
  if (typeof n === "string") return n;
  if (Array.isArray(n)) return n.map(textOf).join(" ");
  return textOf(n.children ?? n.props?.children);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const allText = (r: ReactTestRenderer): string => textOf(r.toJSON()).replace(/\s+/g, " ");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buttons = (r: ReactTestRenderer): any[] => r.root.findAllByType("button");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buttonByText = (r: ReactTestRenderer, label: string): any =>
  buttons(r).find((b) => textOf(b).replace(/\s+/g, " ").trim() === label);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const radioByLabel = (r: ReactTestRenderer, labelPart: string): any =>
  r.root.findAllByType("input").find((i) => i.props.type === "radio" && textOf(i.parent).replace(/\s+/g, " ").includes(labelPart));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const correctionForm = (r: ReactTestRenderer): any =>
  r.root.findAllByType("form").find((f) => f.findAllByType("button").some((b) => textOf(b).trim() === "Save correction"));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const submit = (f: any) => act(() => { f.props.onSubmit({ preventDefault: () => {} }); });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inputByLabel = (r: ReactTestRenderer, part: string): any =>
  r.root.findAllByType("input").find((i) => !i.props.type && textOf(i.parent).includes(part));

describe("VehiclesView admin correction form", () => {
  it("offers Correct on current records only; history rows get neutral labels and no affordance", () => {
    const r = mount({ protections: [
      prot("cur"),
      prot("sup", { lifecycle: "superseded" }),
      prot("rem", { lifecycle: "removed" }),
      prot("bad", { lifecycle: "garbage-legacy" as never }),
    ] });
    expect(buttons(r).filter((b) => textOf(b).trim() === "Correct")).toHaveLength(1);
    const t = allText(r);
    expect(t).toContain("Superseded");
    expect(t).toContain("Removed");
    expect(t).toContain("History");
    expect(t).not.toContain("garbage-legacy");
  });

  it("opens prefilled (incl. warranty years), keeps Save disabled until an explicit scope choice, and keeps recorded scope on 'keep'", () => {
    const onCorrect = vi.fn();
    const r = mount({ protections: [prot("p1", { coverage: "full_front" })], onCorrect });
    act(() => { buttonByText(r, "Correct").props.onClick(); });
    expect(inputByLabel(r, "Provider").props.value).toBe("Garware");
    expect(inputByLabel(r, "Policy or reference number").props.value).toBe("P-1");
    expect(inputByLabel(r, "Warranty (years)").props.value).toBe("5");
    expect(buttonByText(r, "Save correction").props.disabled).toBe(true);
    expect(allText(r)).toContain(COVERAGE_LABEL.full_front);
    act(() => { inputByLabel(r, "Provider").props.onChange({ target: { value: "XPEL" } }); });
    act(() => { radioByLabel(r, "Keep as recorded").props.onChange(); });
    expect(buttonByText(r, "Save correction").props.disabled).toBe(false);
    submit(correctionForm(r));
    expect(onCorrect).toHaveBeenCalledTimes(1);
    const [v, rec, draft] = onCorrect.mock.calls[0] as [Vehicle, Protection, CorrectionDraft];
    expect(v.id).toBe("vA");
    expect(rec.id).toBe("p1");
    expect(draft.provider).toBe("XPEL");
    expect(draft.coverage).toBeUndefined();
  });

  it("the submit HANDLER rejects a missing scope election - Enter/direct submit cannot fall back to keep", () => {
    const onCorrect = vi.fn();
    const r = mount({ onCorrect });
    act(() => { buttonByText(r, "Correct").props.onClick(); });
    submit(correctionForm(r)); // no scope chosen; direct form submit
    expect(onCorrect).not.toHaveBeenCalled();
    expect(allText(r)).toContain("Choose a coverage scope");
    expect(correctionForm(r)).toBeTruthy(); // form stays open
  });

  it("sends an explicitly chosen new scope", () => {
    const onCorrect = vi.fn();
    const r = mount({ protections: [prot("p1", { coverage: null })], onCorrect });
    act(() => { buttonByText(r, "Correct").props.onClick(); });
    expect(allText(r)).toContain("not on file");
    act(() => { radioByLabel(r, COVERAGE_LABEL.high_impact).props.onChange(); });
    submit(correctionForm(r));
    const [, , draft] = onCorrect.mock.calls[0] as [Vehicle, Protection, CorrectionDraft];
    expect(draft.coverage).toBe("high_impact");
  });

  it("blanked fields become explicit null clears, never silent keeps", () => {
    const onCorrect = vi.fn();
    const r = mount({ onCorrect });
    act(() => { buttonByText(r, "Correct").props.onClick(); });
    for (const part of ["Provider", "Policy or reference number", "Notes", "Warranty (years)"]) {
      act(() => { inputByLabel(r, part).props.onChange({ target: { value: "" } }); });
    }
    act(() => { radioByLabel(r, "Keep as recorded").props.onChange(); });
    submit(correctionForm(r));
    const [, , draft] = onCorrect.mock.calls[0] as [Vehicle, Protection, CorrectionDraft];
    expect(draft.provider).toBeNull();
    expect(draft.policyNumber).toBeNull();
    expect(draft.notes).toBeNull();
    expect(draft.warrantyYears).toBeNull();
  });

  it("rejects a junk warranty-years value in the handler", () => {
    const onCorrect = vi.fn();
    const r = mount({ onCorrect });
    act(() => { buttonByText(r, "Correct").props.onClick(); });
    act(() => { inputByLabel(r, "Warranty (years)").props.onChange({ target: { value: "abc" } }); });
    act(() => { radioByLabel(r, "Keep as recorded").props.onChange(); });
    submit(correctionForm(r));
    expect(onCorrect).not.toHaveBeenCalled();
    expect(allText(r)).toContain("whole number");
  });

  it("binds to the record object captured at open, not a later snapshot", () => {
    const onCorrect = vi.fn();
    const r = mount({ onCorrect });
    act(() => { buttonByText(r, "Correct").props.onClick(); });
    act(() => { r.update(createElement(VehiclesView, mountProps({
      protections: [prot("p1", { revision: 3, provider: "Changed-elsewhere" })], onCorrect,
    }))); });
    act(() => { radioByLabel(r, "Keep as recorded").props.onChange(); });
    submit(correctionForm(r));
    const [, rec] = onCorrect.mock.calls[0] as [Vehicle, Protection, CorrectionDraft];
    expect(rec.revision).toBe(2);
    expect(rec.provider).toBe("Garware");
  });

  it("disarms PERMANENTLY on A->B->A: the frozen correction never retargets to car B and never revives on return", () => {
    const onCorrect = vi.fn();
    const r = mount({ onCorrect });
    act(() => { buttonByText(r, "Correct").props.onClick(); });
    expect(correctionForm(r)).toBeTruthy();
    // Navigate to car B (which has a record with the SAME id+revision).
    act(() => { r.update(createElement(VehiclesView, mountProps({ vehicle: carB, protections: [prot("p1", { vehicleId: "vB" })], onCorrect }))); });
    expect(correctionForm(r)).toBeFalsy(); // disarmed while away
    // Back to car A with the identical record: the form must NOT revive.
    act(() => { r.update(createElement(VehiclesView, mountProps({ vehicle: carA, protections: [prot("p1")], onCorrect }))); });
    expect(correctionForm(r)).toBeFalsy();
    expect(onCorrect).not.toHaveBeenCalled();
  });

  it("gives non-cosmetic records no scope UI and stays submittable", () => {
    const onCorrect = vi.fn();
    const r = mount({ protections: [prot("ins", { kind: "insurance", coverage: null, warrantyYears: null })], onCorrect });
    act(() => { buttonByText(r, "Correct").props.onClick(); });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(r.root.findAllByType("input").filter((i: any) => i.props.type === "radio")).toHaveLength(0);
    expect(buttonByText(r, "Save correction").props.disabled).toBe(false);
    submit(correctionForm(r));
    const [, , draft] = onCorrect.mock.calls[0] as [Vehicle, Protection, CorrectionDraft];
    expect(draft.coverage).toBeUndefined();
  });

  it("a RETAINED old submit no-ops after Cancel (not just a hidden form)", () => {
    const onCorrect = vi.fn();
    const r = mount({ onCorrect });
    act(() => { buttonByText(r, "Correct").props.onClick(); });
    act(() => { radioByLabel(r, "Keep as recorded").props.onChange(); });
    const retainedSubmit = correctionForm(r).props.onSubmit as (e: unknown) => void;
    act(() => { buttonByText(r, "Cancel").props.onClick(); });
    // Actually invoke the old closure - the form is gone, but the callback
    // reference still exists and must be dead.
    act(() => { retainedSubmit({ preventDefault: () => {} }); });
    expect(onCorrect).not.toHaveBeenCalled();
  });

  it("a RETAINED old submit no-ops after A->B->A even when B's record matches id+revision", () => {
    const onCorrect = vi.fn();
    const r = mount({ onCorrect });
    act(() => { buttonByText(r, "Correct").props.onClick(); });
    act(() => { radioByLabel(r, "Keep as recorded").props.onChange(); });
    const retainedSubmit = correctionForm(r).props.onSubmit as (e: unknown) => void;
    act(() => { r.update(createElement(VehiclesView, mountProps({ vehicle: carB, protections: [prot("p1", { vehicleId: "vB" })], onCorrect }))); });
    act(() => { r.update(createElement(VehiclesView, mountProps({ vehicle: carA, protections: [prot("p1")], onCorrect }))); });
    act(() => { retainedSubmit({ preventDefault: () => {} }); });
    expect(onCorrect).not.toHaveBeenCalled();
  });

  it("a fresh re-arm after Cancel kills the PREVIOUS retained submit", () => {
    const onCorrect = vi.fn();
    const r = mount({ onCorrect });
    act(() => { buttonByText(r, "Correct").props.onClick(); });
    // Scope chosen BEFORE capture: the retained closure is otherwise valid,
    // so only the arm guard (not the scope guard) can explain the no-op.
    act(() => { radioByLabel(r, "Keep as recorded").props.onChange(); });
    const retainedSubmit = correctionForm(r).props.onSubmit as (e: unknown) => void;
    act(() => { buttonByText(r, "Cancel").props.onClick(); });
    act(() => { buttonByText(r, "Correct").props.onClick(); }); // fresh arm
    act(() => { retainedSubmit({ preventDefault: () => {} }); }); // stale one
    expect(onCorrect).not.toHaveBeenCalled();
  });

  it("an authority change disarms an open correction", () => {
    const onCorrect = vi.fn();
    const r = mount({ onCorrect });
    act(() => { buttonByText(r, "Correct").props.onClick(); });
    expect(correctionForm(r)).toBeTruthy();
    act(() => { r.update(createElement(VehiclesView, mountProps({ authorityKey: "u2|t|", onCorrect }))); });
    expect(correctionForm(r)).toBeFalsy();
    expect(onCorrect).not.toHaveBeenCalled();
  });

  it("refuses rows that do not belong to the viewed car - Correct and status both", () => {
    const onCorrect = vi.fn();
    const onStatus = vi.fn();
    // Stale list: the viewed car is B but the row still belongs to A.
    const r = mount({ vehicle: carB, protections: [prot("p1")], onCorrect, onStatus });
    act(() => { buttonByText(r, "Correct").props.onClick(); });
    expect(correctionForm(r)).toBeFalsy();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sel = r.root.findAllByType("select").find((s: any) => String(s.props["aria-label"]).startsWith("Status of"))!;
    act(() => { sel.props.onChange({ target: { value: "verified" } }); });
    expect(onStatus).not.toHaveBeenCalled();
    expect(onCorrect).not.toHaveBeenCalled();
  });

  it("uses one side panel: opening a correction replaces the add form", () => {
    const r = mount({});
    act(() => { buttonByText(r, "Add a paper").props.onClick(); });
    expect(buttonByText(r, "Save")).toBeTruthy();
    act(() => { buttonByText(r, "Correct").props.onClick(); });
    expect(correctionForm(r)).toBeTruthy();
    expect(buttonByText(r, "Save")).toBeFalsy();
    act(() => { buttonByText(r, "Cancel").props.onClick(); });
    expect(correctionForm(r)).toBeFalsy();
    expect(buttonByText(r, "Add a paper")).toBeTruthy();
  });
});
