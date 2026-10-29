// Guard: the booking detail page redirects to the job page only once the
// visit is live. A cancelled job (customer cancel or no-show auto-cancel)
// must stay on the booking page, or the no-show review panel and the
// cancellation details become unreachable.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("../app/(admin)/bookings/[id]/page.tsx", import.meta.url), "utf8");

describe("booking to job redirect", () => {
  it("redirects only once the car is at the studio", () => {
    expect(page).toMatch(/LIVE_STATUSES = \["STANDBY", "VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY", "DELIVERED"\]/);
    expect(page).toMatch(/if \(job && LIVE_STATUSES\.includes\(job\.status\) && !redirected\.current\) \{ redirected\.current = true; replaceWithoutCounting\(router/);
    // Pre-arrival and cancelled jobs must stay on the booking page.
    expect(page).not.toMatch(/if \(job\) router\.replace/);
  });
});
