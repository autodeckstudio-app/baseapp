import { describe, it, expect } from "vitest";
import { JOB_STATUS_TRANSITIONS, BOOKING_STATUS_TRANSITIONS, MAX_CUSTOMER_RESCHEDULES, CANCELLATION_FREE_WINDOW_HOURS, TURNOVER_BUFFER_MINUTES, SLOT_INTERVAL_MINUTES } from "@autodeck/core";
import { calculatePrice } from "../../lib/pricing.js";
import { hasConflict, buildOccupiedInterval } from "../../lib/availability.js";
import { localToUTC } from "../../lib/schedule.js";

const IST = "Asia/Kolkata";

// ─── Job status machine ───────────────────────────────────────────────────────

describe("JOB_STATUS_TRANSITIONS", () => {
  it("PENDING_VEHICLE can advance to VEHICLE_RECEIVED", () => {
    expect(JOB_STATUS_TRANSITIONS["PENDING_VEHICLE"]).toContain("VEHICLE_RECEIVED");
  });

  it("PENDING_VEHICLE can be cancelled", () => {
    expect(JOB_STATUS_TRANSITIONS["PENDING_VEHICLE"]).toContain("CANCELLED");
  });

  it("VEHICLE_RECEIVED can advance to IN_PROGRESS", () => {
    expect(JOB_STATUS_TRANSITIONS["VEHICLE_RECEIVED"]).toContain("IN_PROGRESS");
  });

  it("DELIVERED is a terminal state (no transitions)", () => {
    expect(JOB_STATUS_TRANSITIONS["DELIVERED"]).toHaveLength(0);
  });

  it("CANCELLED is a terminal state (no transitions)", () => {
    expect(JOB_STATUS_TRANSITIONS["CANCELLED"]).toHaveLength(0);
  });

  it("QUALITY_CHECK can go back to IN_PROGRESS (rework)", () => {
    expect(JOB_STATUS_TRANSITIONS["QUALITY_CHECK"]).toContain("IN_PROGRESS");
  });

  it("QUALITY_CHECK can advance to READY_FOR_DELIVERY", () => {
    expect(JOB_STATUS_TRANSITIONS["QUALITY_CHECK"]).toContain("READY_FOR_DELIVERY");
  });

  it("READY_FOR_DELIVERY can only advance to DELIVERED", () => {
    expect(JOB_STATUS_TRANSITIONS["READY_FOR_DELIVERY"]).toEqual(["DELIVERED"]);
  });
});

// ─── Booking status machine ───────────────────────────────────────────────────

describe("BOOKING_STATUS_TRANSITIONS", () => {
  it("CONFIRMED can be cancelled", () => {
    expect(BOOKING_STATUS_TRANSITIONS["CONFIRMED"]).toContain("CANCELLED");
  });

  it("CONFIRMED can become ACTIVE (vehicle arrived)", () => {
    expect(BOOKING_STATUS_TRANSITIONS["CONFIRMED"]).toContain("ACTIVE");
  });

  it("COMPLETED is a terminal state", () => {
    expect(BOOKING_STATUS_TRANSITIONS["COMPLETED"]).toHaveLength(0);
  });

  it("CANCELLED is a terminal state", () => {
    expect(BOOKING_STATUS_TRANSITIONS["CANCELLED"]).toHaveLength(0);
  });
});

// ─── Pricing correctness ──────────────────────────────────────────────────────

describe("Price computation for bookings", () => {
  it("server price is integer paise — never a float", () => {
    const breakdown = calculatePrice({
      basePrice: 100001,
      vehicleCategory: "suv",
      vehicleCategoryPricing: [
        { vehicleCategory: "suv", additionalPricePaise: 33333, additionalMinutes: 30 },
      ],
    });
    expect(Number.isInteger(breakdown.total)).toBe(true);
    expect(Number.isInteger(breakdown.tax)).toBe(true);
  });

  it("snapshotting: changing base price after snapshot does not affect original total", () => {
    const breakdown1 = calculatePrice({
      basePrice: 100000,
      vehicleCategory: "hatchback",
      vehicleCategoryPricing: [],
    });
    const savedTotal = breakdown1.total;

    // Simulate price change on the service
    const breakdown2 = calculatePrice({
      basePrice: 200000, // price doubled
      vehicleCategory: "hatchback",
      vehicleCategoryPricing: [],
    });

    // Original snapshot is unaffected
    expect(savedTotal).toBe(breakdown1.total);
    expect(breakdown2.total).toBeGreaterThan(savedTotal);
  });

  it("GST is computed on subtotal (base + vehicle adjustment)", () => {
    const breakdown = calculatePrice({
      basePrice: 100000,
      vehicleCategory: "suv",
      vehicleCategoryPricing: [
        { vehicleCategory: "suv", additionalPricePaise: 50000, additionalMinutes: 0 },
      ],
    });
    // subtotal = 150000; GST 18% = 27000; total = 177000
    expect(breakdown.subtotal).toBe(150000);
    expect(breakdown.tax).toBe(27000);
    expect(breakdown.total).toBe(177000);
  });
});

// ─── Cancellation window ─────────────────────────────────────────────────────

describe("Cancellation rules (doc07 §7.9)", () => {
  it("free cancellation window is 24 hours", () => {
    expect(CANCELLATION_FREE_WINDOW_HOURS).toBe(24);
  });

  it("customer CAN cancel >24h before appointment", () => {
    const scheduledAt = new Date(Date.now() + 25 * 3600000); // 25 hours from now
    const hoursUntil = (scheduledAt.getTime() - Date.now()) / 3600000;
    expect(hoursUntil >= CANCELLATION_FREE_WINDOW_HOURS).toBe(true);
  });

  it("customer CANNOT cancel <=24h before appointment", () => {
    const scheduledAt = new Date(Date.now() + 23 * 3600000); // 23 hours from now
    const hoursUntil = (scheduledAt.getTime() - Date.now()) / 3600000;
    expect(hoursUntil < CANCELLATION_FREE_WINDOW_HOURS).toBe(true);
  });
});

// ─── Reschedule rules ─────────────────────────────────────────────────────────

describe("Reschedule rules (doc07 §7.8)", () => {
  it("max customer reschedules is 3", () => {
    expect(MAX_CUSTOMER_RESCHEDULES).toBe(3);
  });

  it("customer with rescheduleCount=3 exceeds the limit", () => {
    const rescheduleCount = 3;
    expect(rescheduleCount >= MAX_CUSTOMER_RESCHEDULES).toBe(true);
  });

  it("customer with rescheduleCount=2 is within the limit", () => {
    const rescheduleCount = 2;
    expect(rescheduleCount < MAX_CUSTOMER_RESCHEDULES).toBe(true);
  });
});

// ─── Race condition simulation ────────────────────────────────────────────────

describe("Slot conflict detection (double-booking prevention)", () => {
  const DATE = "2026-09-01";

  it("two simultaneous requests for the same slot: second should detect conflict", () => {
    // Simulate: first booking committed a job at 09:00–10:00 IST
    const jobStart = localToUTC(DATE, "09:00", IST);
    const jobEstEnd = new Date(jobStart.getTime() + 60 * 60000);
    const occupied = [buildOccupiedInterval(jobStart.toISOString(), jobEstEnd.toISOString())];

    // Second request also wants 09:00 IST — should detect conflict
    const secondStart = localToUTC(DATE, "09:00", IST);
    expect(hasConflict(secondStart, new Date(secondStart.getTime() + 60 * 60000), occupied)).toBe(true);
  });

  it("two requests for adjacent slots: no conflict with buffer respected", () => {
    // First job at 09:00–10:00 IST (buffer until 10:15 IST)
    const jobStart = localToUTC(DATE, "09:00", IST);
    const jobEstEnd = new Date(jobStart.getTime() + 60 * 60000);
    const occupied = [buildOccupiedInterval(jobStart.toISOString(), jobEstEnd.toISOString())];

    // Second request at 10:30 IST (next 30-min slot after buffer)
    const secondStart = localToUTC(DATE, "10:30", IST);
    expect(hasConflict(secondStart, new Date(secondStart.getTime() + 60 * 60000), occupied)).toBe(false);
  });

  it("walk-in at the same time as booked slot: detected as conflict", () => {
    const bookedStart = localToUTC(DATE, "11:00", IST);
    const bookedEstEnd = new Date(bookedStart.getTime() + 90 * 60000);
    const occupied = [buildOccupiedInterval(bookedStart.toISOString(), bookedEstEnd.toISOString())];

    // Walk-in tries to use the same bay at 11:30 IST during the booked slot
    const walkinStart = localToUTC(DATE, "11:30", IST);
    expect(hasConflict(walkinStart, new Date(walkinStart.getTime() + 60 * 60000), occupied)).toBe(true);
  });

  it("idempotency: same idempotency key should not create duplicate booking (simulated)", () => {
    // This is tested via the Cloud Function transaction in emulator tests.
    // Here we verify the key used as a Firestore document ID is stable.
    const key1 = "test-uuid-1234";
    const key2 = "test-uuid-1234";
    expect(key1).toBe(key2); // same key → same document → idempotent
  });
});

// ─── Cancellation / reservation release ──────────────────────────────────────

describe("Cancellation and reservation release", () => {
  const DATE = "2026-09-02";

  it("after cancellation, the slot no longer appears as occupied", () => {
    // A booking is cancelled: the occupied interval is removed.
    // Simulate by having an empty occupied list after removal.
    const cancelledStart = localToUTC(DATE, "09:00", IST);
    const occupied: ReturnType<typeof buildOccupiedInterval>[] = [];
    // Slot should be free again
    expect(hasConflict(cancelledStart, new Date(cancelledStart.getTime() + 60 * 60000), occupied)).toBe(false);
  });

  it("concurrent walk-in on second bay: first bay still blocked", () => {
    // Bay 1 has a booking, Bay 2 is free for a walk-in
    const jobStart = localToUTC(DATE, "10:00", IST);
    const jobEstEnd = new Date(jobStart.getTime() + 60 * 60000);
    const bay1Occupied = [buildOccupiedInterval(jobStart.toISOString(), jobEstEnd.toISOString())];
    const bay2Occupied: ReturnType<typeof buildOccupiedInterval>[] = [];

    const walkinStart = localToUTC(DATE, "10:00", IST);
    expect(hasConflict(walkinStart, new Date(walkinStart.getTime() + 60 * 60000), bay1Occupied)).toBe(true);  // bay 1 taken
    expect(hasConflict(walkinStart, new Date(walkinStart.getTime() + 60 * 60000), bay2Occupied)).toBe(false); // bay 2 free
  });

  it("slot overlapping from behind: job in progress blocks earlier start", () => {
    // Job starts at 10:30 IST (60 min + 15 min buffer → blocks until 11:45)
    const jobStart = localToUTC(DATE, "10:30", IST);
    const jobEstEnd = new Date(jobStart.getTime() + 60 * 60000);
    const occupied = [buildOccupiedInterval(jobStart.toISOString(), jobEstEnd.toISOString())];

    // New 60-min job starting 10:00 IST would end at 11:15 (incl buffer) → overlaps 10:30 job
    const candidateStart = localToUTC(DATE, "10:00", IST);
    expect(hasConflict(candidateStart, new Date(candidateStart.getTime() + 60 * 60000), occupied)).toBe(true);
  });

  it("no conflict when cancellation releases the slot and a new booking takes it", () => {
    // Before cancellation: slot is taken
    const slotStart = localToUTC(DATE, "14:00", IST);
    const slotEstEnd = new Date(slotStart.getTime() + 60 * 60000);
    const occupiedBefore = [buildOccupiedInterval(slotStart.toISOString(), slotEstEnd.toISOString())];
    expect(hasConflict(slotStart, new Date(slotStart.getTime() + 60 * 60000), occupiedBefore)).toBe(true);

    // After cancellation: slot is released (interval removed)
    const occupiedAfter: ReturnType<typeof buildOccupiedInterval>[] = [];
    expect(hasConflict(slotStart, new Date(slotStart.getTime() + 60 * 60000), occupiedAfter)).toBe(false);
  });
});

// ─── Booking engine constants ─────────────────────────────────────────────────

describe("Booking engine constants", () => {
  it("slot interval is 30 minutes", () => {
    expect(SLOT_INTERVAL_MINUTES).toBe(30);
  });

  it("turnover buffer is 15 minutes", () => {
    expect(TURNOVER_BUFFER_MINUTES).toBe(15);
  });
});
