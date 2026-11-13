import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { getRescheduleEligibility } from "./booking-rules";

const detail = readFileSync("src/app/(tabs)/bookings/[id].tsx", "utf8");
const confirm = readFileSync("src/app/(tabs)/book/confirm.tsx", "utf8");

describe("pending online payment copy", () => {
  it("never says a pending online booking awaits studio confirmation", () => {
    const r = getRescheduleEligibility({ status: "PENDING", payMode: "online", rescheduleCount: 0 } as never);
    expect(r.reason).toMatch(/payment/i);
    expect(r.reason).not.toMatch(/studio confirmation/i);
  });
  it("held studio advances also wait for payment rather than studio confirmation", () => {
    const r = getRescheduleEligibility({ status: "PENDING", payMode: "studio", holdExpiresAt: "2026-11-03T11:30:00Z", rescheduleCount: 0 } as never);
    expect(r.reason).toMatch(/waiting for payment/);
  });
  it("labels payment separately from verified physical visit state", () => {
    expect(detail).toContain("customerPaymentLabel(payment");
    expect(readFileSync("src/lib/existing-job-payment.ts", "utf8")).toContain("Online payment pending");
    expect(detail).toContain('job && !bookingClosed && jobStage(job.status) && job.status !== "DELIVERED" && job.status !== "PENDING_VEHICLE"');
    expect(detail).toContain('const showLiveVisit=!bookingClosed;');
    expect(detail).toContain('title="Slot held until"');
    expect(detail).toContain('detail="After verified payment."');
    expect(detail).not.toContain("until the payment goes through");
  });
  it("retitles the confirm notice while a slot is held", () => {
    expect(confirm).toContain('held ? "Payment pending"');
  });
});
