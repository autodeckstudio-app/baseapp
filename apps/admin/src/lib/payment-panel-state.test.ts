// TEST. Transitions loading -> none / present, and that no payment control is offered before the listener answers.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canOfferPayment, paymentPanelMode } from "./payment-panel-state";
describe("paymentPanelMode", () => {
  it("loading before the first snapshot, then none or present; a refunded payment is present", () => {
    expect(paymentPanelMode(undefined)).toBe("loading");
    expect(paymentPanelMode(null)).toBe("none");
    expect(paymentPanelMode({ id: "p1" })).toBe("present");
  });
});
describe("canOfferPayment", () => {
  it("nothing while loading, even for an unpaid job", () => expect(canOfferPayment(undefined, "unpaid")).toEqual({ link: false, counter: false }));
  it("unpaid and no payment: link and counter", () => expect(canOfferPayment(null, "unpaid")).toEqual({ link: true, counter: true }));
  it("a pending or refunded payment gets no new link", () => {
    expect(canOfferPayment({ status: "pending" }, "unpaid").link).toBe(false);
    expect(canOfferPayment({ status: "refunded" }, "unpaid").link).toBe(false);
  });
  it("failed or cancelled payment may be retried with a new link", () => {
    expect(canOfferPayment({ status: "failed" }, "unpaid").link).toBe(true);
    expect(canOfferPayment({ status: "cancelled" }, "unpaid").link).toBe(true);
  });
  it("paid jobs offer nothing", () => expect(canOfferPayment(null, "paid")).toEqual({ link: false, counter: false }));
});

describe("coveredVisitSettlementNote", () => {
  it("covered and not yet settled (gate ON): note suppressed, the settle tile is the single action", async () => {
    const { coveredVisitSettlementNote } = await import("./payment-panel-state");
    expect(
      coveredVisitSettlementNote({ membershipWashUsed: true, totalAmount: 0 }, null),
    ).toBeNull();
    // The pre-release studio Rs-0 instruction stays in source behind the flag (see gate semantics below).
  });
  it("booking-level coverage alone (job has no membershipWashUsed): gate ON suppresses the note too", async () => {
    const { coveredVisitSettlementNote } = await import("./payment-panel-state");
    expect(
      coveredVisitSettlementNote(null, { membershipWashUsed: true, totalAmount: 0 }),
    ).toBeNull();
    expect(
      coveredVisitSettlementNote({ totalAmount: 50000 }, { membershipWashUsed: true, totalAmount: 0 }),
    ).toBeNull();
  });
  it("already settled (settlementKind membership_covered): no note, nothing left to do", async () => {
    const { coveredVisitSettlementNote } = await import("./payment-panel-state");
    expect(
      coveredVisitSettlementNote(
        { settlementKind: "membership_covered", membershipWashUsed: true, totalAmount: 0 },
        null,
      ),
    ).toBeNull();
  });
  it("gate semantics: note suppressed exactly when the settle action ships (no duplicate actions gate-ON, old route preserved gate-OFF)", () => {
    const src = readFileSync(join(__dirname, "payment-panel-state.ts"), "utf8");
    // The flag check sits between the unsettled match and the old-route instruction.
    expect(src).toContain("MEMBERSHIP_SETTLEMENT_ENABLED");
    expect(src.indexOf("if (!unsettled(job) && !unsettled(booking)) return null;")).toBeLessThan(
      src.indexOf("if (MEMBERSHIP_SETTLEMENT_ENABLED) return null;"),
    );
    expect(src.indexOf("if (MEMBERSHIP_SETTLEMENT_ENABLED) return null;")).toBeLessThan(
      src.indexOf("Record cash payment for Rs 0"),
    );
    // Gate ON now: the note is suppressed (tests above); the old-route copy stays in source as the pre-release fallback.
  });
  it("ordinary unpaid job: no note and payment actions remain offerable (no dead end)", async () => {
    const { coveredVisitSettlementNote } = await import("./payment-panel-state");
    const job = { membershipWashUsed: false, totalAmount: 50000 };
    expect(coveredVisitSettlementNote(job, null)).toBeNull();
    expect(canOfferPayment(null, "unpaid")).toEqual({ link: true, counter: true });
  });
  it("covered but with a non-zero amount: no note (not a zero-settlement case)", async () => {
    const { coveredVisitSettlementNote } = await import("./payment-panel-state");
    expect(
      coveredVisitSettlementNote({ membershipWashUsed: true, totalAmount: 100 }, null),
    ).toBeNull();
  });
});

describe("coveredSettlePanelVisible (single-tile consolidation)", () => {
  const coveredJob = { membershipWashUsed: true, totalAmount: 0, status: "READY_FOR_DELIVERY" };
  const coveredBooking = { membershipWashUsed: true, totalAmount: 0, status: "CONFIRMED" };
  it("gate ON: visible for a covered, unsettled, open visit (Payment panel yields to the single settle tile)", async () => {
    const { coveredSettlePanelVisible } = await import("./payment-panel-state");
    expect(coveredSettlePanelVisible(coveredJob, coveredBooking)).toBe(true);
  });
  it("gate ON negatives: settled, cancelled, or non-zero visits stay hidden", async () => {
    const { coveredSettlePanelVisible } = await import("./payment-panel-state");
    expect(coveredSettlePanelVisible({ ...coveredJob, settlementKind: "membership_covered" }, coveredBooking)).toBe(false);
    expect(coveredSettlePanelVisible({ ...coveredJob, status: "CANCELLED" }, coveredBooking)).toBe(false);
    expect(coveredSettlePanelVisible({ ...coveredJob, totalAmount: 100 }, coveredBooking)).toBe(false);
    expect(coveredSettlePanelVisible(coveredJob, null)).toBe(false);
  });
  it("gate semantics: flag check first, then the same covered/open conditions as MembershipSettlement", () => {
    const src = readFileSync(join(__dirname, "payment-panel-state.ts"), "utf8");
    const fn = src.slice(src.indexOf("export function coveredSettlePanelVisible"));
    expect(fn.indexOf("if (!MEMBERSHIP_SETTLEMENT_ENABLED) return false;")).toBeLessThan(fn.indexOf("membershipWashUsed"));
    for (const guard of [
      'job.settlementKind === "membership_covered"',
      "booking.membershipWashUsed !== true",
      "booking.totalAmount !== 0 || job.totalAmount !== 0",
      'job.status === "CANCELLED"',
      'booking.status === "CANCELLED"',
      'booking.status === "EXPIRED"',
    ]) expect(fn).toContain(guard);
    const panel = readFileSync(join(__dirname, "../components/JobPaymentPanel.tsx"), "utf8");
    // The Payment panel yields before rendering anything when the settle panel owns the state.
    expect(panel.indexOf("if (coveredSettlePanelVisible(job, booking)) return null;")).toBeLessThan(panel.indexOf("return ("));
  });
});
