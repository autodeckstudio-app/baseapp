import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(`${__dirname}/../${p}`, "utf8");

describe("admin cancel UI", () => {
  const panel = read("components/CancelBookingPanel.tsx");
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
  it("is on the booking page and the pickups page can set a no-pin fee", () => {
    expect(read("app/(admin)/bookings/[id]/page.tsx")).toContain("<CancelBookingPanel");
    expect(read("app/(admin)/pickups/page.tsx")).toContain("Pickup fee in rupees");
  });
});
