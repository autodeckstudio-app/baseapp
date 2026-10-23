// Guard: the booking detail page redirects to the job page only once the
// visit is live. A cancelled job (customer cancel or no-show auto-cancel)
// must stay on the booking page, or the no-show review panel and the
// cancellation details become unreachable.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("../app/(admin)/bookings/[id]/page.tsx", import.meta.url), "utf8");

describe("booking to job redirect", () => {
  it("does not redirect for cancelled jobs", () => {
    expect(page).toMatch(/if \(job && job\.status !== "CANCELLED"\) router\.replace/);
  });
});
