import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
const { createElement } = React;
(globalThis as unknown as { React: typeof React }).React = React;
import { DashboardView } from "./DashboardView";

// TEST. The dashboard must not say "All clear" while refunds are owed: the owed line is an attention row (the Money panel is hidden at wide widths by canvas.css).
const base = {
  today: "2026-10-24", now: new Date("2026-10-24T07:00:00Z"), revenueToday: 150000,
  tiles: { bookings: 3, active: 0, delivered: 0, walkins: 0, staffPresent: 0 }, floor: { arriving: 0, working: 0, ready: 0, delivered: 0 },
  counts: { failedPayments: 0, unpaidDelivered: 0, pendingApprovals: 0, staleJobs: 0, pendingPayments: 0, expiringMemberships: 0, lowStock: 0, pendingPapers: 0 },
  onOpen: () => undefined,
};
describe("dashboard owed", () => {
  it("owed text present: shown in Needs attention, no All clear, not netted into Taken today", () => {
    const html = renderToStaticMarkup(createElement(DashboardView, { ...base, refundsOwedText: "Refunds owed to customers: ₹1,450 across 2 bookings, not yet returned." }));
    expect(html).toContain("Refunds owed to customers: ₹1,450");
    expect(html).not.toContain("All clear");
    expect(html).toContain("₹1,500");
  });
  it("no owed: All clear stays", () => {
    const html = renderToStaticMarkup(createElement(DashboardView, { ...base, refundsOwedText: null }));
    expect(html).toContain("All clear"); expect(html).not.toContain("Refunds owed");
  });
  it("incomplete owed text also qualifies the page (truncated, zero total)", () => {
    const html = renderToStaticMarkup(createElement(DashboardView, { ...base, refundsOwedText: "Refunds owed to customers: ₹0 across 0 bookings. may be incomplete." }));
    expect(html).toContain("may be incomplete"); expect(html).not.toContain("All clear");
  });
});
