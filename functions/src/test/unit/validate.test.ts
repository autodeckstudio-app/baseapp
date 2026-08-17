import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";

describe("validate middleware", () => {
  const schema = z.object({
    name: z.string().min(2),
    age: z.number().int().min(0),
  });

  it("returns parsed data for valid input", () => {
    const result = validate(schema, { name: "Alice", age: 25 });
    expect(result).toEqual({ name: "Alice", age: 25 });
  });

  it("throws HttpsError with invalid-argument for missing required field", () => {
    expect(() => validate(schema, { age: 25 })).toThrow();
    try {
      validate(schema, { age: 25 });
    } catch (err: unknown) {
      expect((err as { code?: string }).code).toBe("invalid-argument");
    }
  });

  it("throws HttpsError for wrong type", () => {
    expect(() => validate(schema, { name: "Alice", age: "not-a-number" })).toThrow();
    try {
      validate(schema, { name: "Alice", age: "not-a-number" });
    } catch (err: unknown) {
      expect((err as { code?: string }).code).toBe("invalid-argument");
    }
  });

  it("throws HttpsError with field path in message for nested error", () => {
    const nested = z.object({ user: z.object({ name: z.string().min(2) }) });
    try {
      validate(nested, { user: { name: "A" } });
    } catch (err: unknown) {
      expect((err as { message?: string }).message).toContain("user.name");
    }
  });
});

describe("vehicle schema validation", () => {
  it("accepts valid India registration number", async () => {
    const { createVehicleSchema } = await import("../../schemas/vehicle.js");
    const result = createVehicleSchema.safeParse({
      registrationNumber: "GJ01AB1234",
      make: "Maruti",
      model: "Swift",
      year: 2022,
      color: "White",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid registration number", async () => {
    const { createVehicleSchema } = await import("../../schemas/vehicle.js");
    const result = createVehicleSchema.safeParse({
      registrationNumber: "NOT-VALID",
      make: "Maruti",
      model: "Swift",
      year: 2022,
      color: "White",
    });
    expect(result.success).toBe(false);
  });

  it("rejects future year beyond next year", async () => {
    const { createVehicleSchema } = await import("../../schemas/vehicle.js");
    const result = createVehicleSchema.safeParse({
      registrationNumber: "GJ01AB1234",
      make: "Maruti",
      model: "Swift",
      year: new Date().getFullYear() + 5,
      color: "White",
    });
    expect(result.success).toBe(false);
  });
});

describe("customer schema validation", () => {
  it("accepts valid name", async () => {
    const { setupCustomerProfileSchema } = await import("../../schemas/customer.js");
    const result = setupCustomerProfileSchema.safeParse({ name: "Rahul Shah" });
    expect(result.success).toBe(true);
  });

  it("rejects name shorter than 2 chars", async () => {
    const { setupCustomerProfileSchema } = await import("../../schemas/customer.js");
    const result = setupCustomerProfileSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });

  it("allows missing name for returning customers", async () => {
    const { setupCustomerProfileSchema } = await import("../../schemas/customer.js");
    const result = setupCustomerProfileSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
