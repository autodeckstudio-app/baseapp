import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// One detail page per visit. These pin that nothing the Booking page could do was lost when its
// panels moved into the Job page, and that every write still goes through the same backend call.
describe("visit: booking panels live on the Job page", () => {
  const panels = read("components/BookingPanels.tsx");
  const job = read("app/(admin)/jobs/[id]/page.tsx");
  const booking = read("app/(admin)/bookings/[id]/page.tsx");

  it("quote and cancel keep their backend calls", () => {
    expect(panels).toContain("setBookingQuote(booking.id");
    expect(panels).toContain("<CancelBookingPanel booking={booking} job={job}");
    const cancel = read("components/CancelBookingPanel.tsx");
    expect(cancel).toContain("adminCancelBooking");
    expect(cancel).toContain("settleCancellationFee");
  });
  it("the job page loads the booking and shows the panels for booked jobs", () => {
    expect(job).toContain("listenToBooking(bookingId");
    expect(job).toContain("<BookingPanels booking={booking}");
    expect(job).not.toContain("Open booking");
  });
  it("the booking page uses the same panels and hands over to the job once it exists", () => {
    expect(booking).toContain("<BookingPanels");
    expect(booking).toContain("router.replace(`/jobs/${job.id}`)");
  });
  it("the quote, slot and price sections all exist exactly once in the panels", () => {
    for (const label of [">Slot<", ">Quote<", ">Price<"]) expect(panels.split(label).length - 1).toBe(1);
  });
});
