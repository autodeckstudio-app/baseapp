import { describe, expect, it } from "vitest";
import { createBookingSchema, getAvailabilitySchema, rescheduleBookingSchema, requestBookingRescheduleSchema } from "../../schemas/booking.js";

const create = { serviceId: "wash", vehicleId: "car", vehicleCategory: "sedan", studioId: "studio", scheduledDate: "2028-02-29", scheduledTime: "09:30", idempotencyKey: "local" };
const move = { bookingId: "booking", newDate: "2028-02-29", newTime: "09:30", idempotencyKey: "local" };
describe("booking calendar inputs", () => {
  it.each(["25:00", "99:99", "24:00", "12:60", "-1:00", "9:00"])("rejects invalid time %s on every booking write", (time) => {
    expect(createBookingSchema.safeParse({ ...create, scheduledTime: time }).success).toBe(false);
    expect(rescheduleBookingSchema.safeParse({ ...move, newTime: time }).success).toBe(false);
    expect(requestBookingRescheduleSchema.safeParse({ ...move, newTime: time }).success).toBe(false);
  });
  it.each(["2027-02-29", "2028-02-30", "2028-04-31", "2028-00-10", "2028-13-01", "2028-01-00"])("rejects impossible date %s on all booking routes", (date) => {
    expect(createBookingSchema.safeParse({ ...create, scheduledDate: date }).success).toBe(false);
    expect(rescheduleBookingSchema.safeParse({ ...move, newDate: date }).success).toBe(false);
    expect(requestBookingRescheduleSchema.safeParse({ ...move, newDate: date }).success).toBe(false);
    expect(getAvailabilitySchema.safeParse({ serviceId: "wash", studioId: "studio", startDate: date }).success).toBe(false);
  });
  it.each(["00:00", "09:30", "23:59"])("preserves valid time %s and leap-day/mixed-service payloads", (time) => {
    expect(createBookingSchema.safeParse({ ...create, scheduledTime: time, extraServiceIds: ["coating"] }).success).toBe(true);
    expect(rescheduleBookingSchema.safeParse({ ...move, newTime: time }).success).toBe(true);
    expect(requestBookingRescheduleSchema.safeParse({ ...move, newTime: time }).success).toBe(true);
    expect(getAvailabilitySchema.safeParse({ serviceId: "wash", studioId: "studio", startDate: "2028-02-29", extraServiceIds: ["coating"] }).success).toBe(true);
  });
  it("does not use the JavaScript Date year-0-to-99 remapping", () => {
    expect(createBookingSchema.safeParse({ ...create, scheduledDate: "0096-02-29" }).success).toBe(true);
    expect(createBookingSchema.safeParse({ ...create, scheduledDate: "0100-02-29" }).success).toBe(false);
    expect(createBookingSchema.safeParse({ ...create, scheduledDate: "2000-02-29" }).success).toBe(true);
    expect(createBookingSchema.safeParse({ ...create, scheduledDate: "2100-02-29" }).success).toBe(false);
  });
});
