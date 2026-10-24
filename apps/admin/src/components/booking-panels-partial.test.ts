import { describe, it, expect, vi } from "vitest";
vi.mock("../lib/bookings-service", () => ({ setBookingQuote: async () => undefined }));
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
(globalThis as unknown as { React: typeof React }).React = React;
import { BookingPanels } from "./BookingPanels";

// TEST (render): a PARTIAL priceBreakdown never prints NaN; a complete one prints its figures.
const mk = (pb: unknown) => renderToStaticMarkup(React.createElement(BookingPanels, {
  booking: { id: "b", status: "CONFIRMED", totalAmount: 100000, durationMinutes: 60, scheduledAt: "2026-10-26T09:30:00.000Z", estimatedEndAt: "2026-10-26T10:30:00.000Z", priceBreakdown: pb } as never,
  job: null, service: null, bayName: "Bay 1", onError: () => {},
}));
describe("booking panels partial breakdown", () => {
  it("partial breakdown has no NaN and no negative-NaN membership", () => {
    const html = mk({ basePrice: 100000 });
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("-₹");
  });
  it("complete breakdown prints figures", () => {
    const html = mk({ basePrice: 100000, scopeAdjustment: 0, membershipDiscount: null, subtotal: 100000, tax: 0, total: 100000 });
    expect(html).toContain("₹1,000");
    expect(html).not.toContain("NaN");
  });
});
