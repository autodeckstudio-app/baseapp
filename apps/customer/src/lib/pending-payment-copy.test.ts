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
  it("labels the payment row and hides the Live chip while payment is pending", () => {
    expect(detail).toContain("Awaiting payment");
    expect(detail).toMatch(/!\(booking\.status === "PENDING" && booking\.payMode === "online"\)/);
    expect(detail).toContain("Held until");
  });
  it("retitles the confirm notice while a slot is held", () => {
    expect(confirm).toContain('held ? "Payment pending"');
  });
});
