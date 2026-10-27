import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(`${__dirname}/../${p}`, "utf8");

describe("admin cancel UI", () => {
  const panel = read("components/CancelBookingPanel.tsx");
  it("never imports lib/firebase at module scope (lazy only, like bookings-service)", () => {
    const topLevel = panel.split(String.fromCharCode(10)).filter((l) => l.startsWith("import ") && l.includes('from "../lib/firebase"'));
    expect(topLevel).toEqual([]);
    expect(panel).toContain('await import("../lib/firebase")');
  });
  it("shows the paid, fee and refund numbers (preview) before the confirm button exists", () => {
    expect(panel).toContain("preview: true");
    expect(panel.indexOf("Review")).toBeLessThan(panel.indexOf("Confirm cancel"));
    expect(panel).toContain("Refund to customer");
  });
  it("offers collect and waive for a due fee, and no em dashes", () => {
    expect(panel).toContain("Mark fee collected");
    expect(panel).toContain("Waive fee");
    expect(panel).not.toContain("\u2014");
  });
  it("is on the booking and job pages and the pickups page can set a no-pin fee", () => {
    // The panel is mounted by BookingPanels, which the booking page and the job page both render.
    expect(read("components/BookingPanels.tsx")).toContain("<CancelBookingPanel");
    expect(read("app/(admin)/bookings/[id]/page.tsx")).toContain("<BookingPanels");
    expect(read("app/(admin)/jobs/[id]/page.tsx")).toContain("<BookingPanels");
    expect(read("app/(admin)/pickups/page.tsx")).toContain("Pickup fee in rupees");
  });
});
