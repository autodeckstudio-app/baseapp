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

it("grouped pending request uses exact whole-visit review link, not a per-service approve",()=>{const html=renderToStaticMarkup(React.createElement(BookingPanels,{booking:{id:'b',status:'CONFIRMED',totalAmount:10000,durationMinutes:60,scheduledAt:'2026-11-16T04:00:00Z',estimatedEndAt:'2026-11-16T05:00:00Z',rescheduleRequest:{status:'pending',requestedDate:'2026-11-17',requestedTime:'09:00'}}as never,job:{id:'j',visitId:'v'}as never,service:null,bayName:'Wash',onError:()=>{}}));expect(html).toContain('/jobs/j#visit-schedule');expect(html).toContain('Review visit times');expect(html).not.toContain('Approve move');expect(html).toContain('Decline')});
