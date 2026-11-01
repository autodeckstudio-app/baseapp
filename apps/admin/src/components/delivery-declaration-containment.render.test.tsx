// Phone-width containment guard for the delivery declaration. The record
// select's distinguishing labels (kind - scope - date - source - ref) are
// intentionally long; unpinned, the select's intrinsic width blew the grid
// chain out past the card on narrow screens and clipped the declaration's
// text and buttons at the shell edge (found on the 390px pixel pass). This
// mounts the REAL DeliveryDeclaration and asserts the containment props that
// keep every link of the chain shrinkable and the select pinned to its
// container, so the failure cannot silently return.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { create, act } from "react-test-renderer";
import { createElement } from "react";
import type { Protection, ServiceJob } from "@autodeck/core";

const getDocs = vi.fn();
vi.mock("firebase/firestore", () => ({
  collection: (...a: unknown[]) => ({ a }),
  query: (...a: unknown[]) => ({ a }),
  where: (...a: unknown[]) => ({ a }),
  getDocs: (...a: unknown[]) => getDocs(...a),
  doc: (...a: unknown[]) => ({ a }),
  getDoc: async () => ({ exists: () => false, data: () => undefined }),
}));
vi.mock("firebase/functions", () => ({ httpsCallable: () => async () => ({ data: {} }) }));
vi.mock("../lib/firebase", () => ({ db: {}, functions: {} }));
vi.mock("../lib/auth-context", () => ({ useAdminAuth: () => ({ user: { uid: "u1" }, claims: { role: "admin", tenantId: "t", studioId: "s1" }, loading: false }) }));

import { DeliveryDeclaration } from "./DeliveryDeclaration";

const prot: Protection = ({ id: "p1", tenantId: "t", vehicleId: "vA", customerId: "c", kind: "ppf", provider: "Garware", policyNumber: null, startDate: "2026-06-12", expiryDate: null, documentUrl: null, status: "unverified", source: "customer", verifiedBy: null, verifiedAt: null, notes: null, revision: 2, coverage: "full_body", createdAt: "x", updatedAt: "x" } as Protection);
const job = { id: "jA", vehicleId: "vA", tenantId: "t", studioId: "s1", status: "READY_FOR_DELIVERY", paymentStatus: "paid", serviceId: "sv1" } as ServiceJob;
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const click = (el: any, label: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const textOf = (n: any): string => { const w = (x: any): string => x === null || x === undefined || typeof x === "boolean" ? "" : typeof x === "string" ? x : Array.isArray(x) ? x.map(w).join(" ") : w(x.children); return w(n).replace(/\s+/g, " ").trim(); };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hit = el.root.findAll((n: any) => typeof n.props.onClick === "function" && textOf({ children: [n] }) === label);
  if (hit.length === 0) throw new Error(`no clickable ${label}`);
  act(() => { hit[hit.length - 1]!.props.onClick(); });
};

beforeEach(() => { getDocs.mockReset(); getDocs.mockResolvedValue({ docs: [{ id: "p1", data: () => prot }] }); });

describe("delivery declaration narrow-width containment", () => {
  it("keeps every grid link shrinkable and pins the record select to its container", async () => {
    let el!: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { el = create(createElement(DeliveryDeclaration, { job, onDelivered: () => {}, onCancel: () => {} })); });
    await flush();
    const root = el.root.findByProps({ className: "ax-delivery" });
    expect(root.props.style.minWidth).toBe(0);
    expect(el.root.findByType("fieldset").props.style.minWidth).toBe(0);
    // Drive to the filled state so the record select exists.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const radios = el.root.findAll((n: any) => n.type === "input" && n.props.type === "radio");
    act(() => { radios[1]!.props.onChange(); }); // Record work
    click(el, "Add replace");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const select = el.root.findAll((n: any) => n.type === "select" && n.props["aria-label"] === "Replace target 1")[0]!;
    expect(select.props.style).toMatchObject({ width: "100%", minWidth: 0, maxWidth: "100%" });
    // The label wrapping the select and every grid container in the chain shrink.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shrinkable = el.root.findAll((n: any) => n.props && n.props.style && n.props.style.minWidth === 0);
    expect(shrinkable.length).toBeGreaterThanOrEqual(5); // root, fieldset, events box, event card, label
    // The Add install/replace/removal row wraps instead of forcing the chain wide.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addInstall = el.root.findAll((n: any) => n.type === "button" && n.children && n.children.join("") === "Add install")[0]!;
    expect(addInstall.parent.props.style).toMatchObject({ flexWrap: "wrap", minWidth: 0 });
  });
});
