import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read = (p: string) => readFileSync(p, "utf8");

describe("round 8 fix 2: reschedule hidden on the post-booking landing view", () => {
  const detail = read("src/app/(tabs)/bookings/[id].tsx");
  it("the reschedule section stays hidden only when opened with placed=1", () => {
    expect(detail).toContain('const showRescheduleSection = placed !== "1" &&');
  });
  it("the cancel flow keeps its own Reschedule instead button", () => {
    expect(detail).toContain('label="Reschedule instead"');
  });
  it("the reschedule screen and rules keep their own logic", () => {
    expect(read("src/app/(tabs)/bookings/reschedule.tsx")).toContain("rescheduleBooking");
    expect(read("src/lib/booking-rules.ts")).toContain("getRescheduleEligibility");
  });
});

describe("round 8 fixes 3-4: pickup/drop is chosen while booking and sent with Confirm booking", () => {
  const confirm = read("src/app/(tabs)/book/confirm.tsx");
  const card = read("src/ui/PickupCard.tsx");
  it("the confirm screen carries the optional section: kind chips, address, location and slot dropdown", () => {
    expect(confirm).toContain("Pickup and drop (optional)");
    expect(confirm).toContain("pickupSlotsFor(params.scheduledTime)");
    expect(confirm).toContain("SelectField");
    expect(confirm).toContain("getDeviceLocation");
    expect(confirm).toContain("This is your preference, not a confirmed slot. The studio agrees the exact time with you by phone call.");
  });
  it("pickup is submitted with the booking in both the studio-pay and the paid paths, never by a separate Send button", () => {
    expect(confirm).toContain("sendPickupRequest(result.id)");
    expect(confirm).toContain("sendPickupRequest(h.bookingId)");
    expect(confirm).not.toContain("Send request");
  });
  it("a failed pickup request never fails the booking; the booking page shows the note", () => {
    expect(confirm).toContain('pickup: "failed"');
    const detail = read("src/app/(tabs)/bookings/[id].tsx");
    expect(detail).toContain('pickup === "failed"');
    expect(detail).toContain("Pickup request not sent");
  });
  it("the drop-off time field is gone and its value is never sent", () => {
    expect(confirm).not.toContain("requestedDropTime");
    expect(confirm).not.toContain("Preferred drop-off time");
    expect(card).not.toContain("Preferred drop-off time");
  });
  it("the booking page card shows request status only - no form or entry point", () => {
    expect(card).not.toContain("Request pickup or drop");
    expect(card).not.toContain("Send request");
    expect(card).not.toContain("requestPickupDrop(");
    expect(card).not.toContain("getDeviceLocation");
    expect(card).toContain("Waiting for studio approval");
    expect(card).toContain("agreedPickupAt");
    expect(card).toContain("if (!req) return null;");
  });
  it("fee and distance wording has one shared source", () => {
    const policy = read("src/lib/pickup-policy.ts");
    expect(policy).toContain("PICKUP_NEAR_KM");
    expect(confirm).toContain("PICKUP_POLICY");
    expect(card).toContain("PICKUP_POLICY");
  });
  it("pickup stays optional and reversible: deselecting clears kind, address, slot and location", () => {
    expect(confirm).toContain('setPickupKind(null);\n      setPickupAddress("");\n      setPickupSlot("");\n      setPickupWhere(null);');
  });
});
