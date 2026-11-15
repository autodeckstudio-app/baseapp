// Regression coverage for Phase 5B P1-12: every exported Zod object schema
// under functions/src/schemas/ must be in strict mode (reject unknown
// fields), matching doc08 §8.6 ("z.object({...}).strict() — unknown fields
// cause validation failure"). This is a meta-test — it enumerates every
// schema module's exports rather than hand-listing each schema, so a future
// schema added without .strict() fails this test automatically instead of
// silently slipping through.
import { describe, it, expect } from "vitest";
import { ZodObject, type ZodTypeAny } from "zod";

import * as approvalSchemas from "../../schemas/approval.js";
import * as bookingSchemas from "../../schemas/booking.js";
import * as customerSchemas from "../../schemas/customer.js";
import * as employeeSchemas from "../../schemas/employee.js";
import * as inspectionSchemas from "../../schemas/inspection.js";
import * as invoiceSchemas from "../../schemas/invoice.js";
import * as jobSchemas from "../../schemas/job.js";
import * as membershipSchemas from "../../schemas/membership.js";
import * as notificationSchemas from "../../schemas/notification.js";
import * as paymentSchemas from "../../schemas/payment.js";
import * as protectionSchemas from "../../schemas/protection.js";
import * as serviceSchemas from "../../schemas/service.js";
import * as studioSchemas from "../../schemas/studio.js";
import * as vehicleSchemas from "../../schemas/vehicle.js";

const modules: Record<string, Record<string, unknown>> = {
  approval: approvalSchemas,
  booking: bookingSchemas,
  customer: customerSchemas,
  employee: employeeSchemas,
  inspection: inspectionSchemas,
  invoice: invoiceSchemas,
  job: jobSchemas,
  membership: membershipSchemas,
  notification: notificationSchemas,
  payment: paymentSchemas,
  protection: protectionSchemas,
  service: serviceSchemas,
  studio: studioSchemas,
  vehicle: vehicleSchemas,
};

function collectObjectSchemas(): Array<{ moduleFile: string; exportName: string; schema: ZodObject<Record<string, ZodTypeAny>> }> {
  const found: Array<{ moduleFile: string; exportName: string; schema: ZodObject<Record<string, ZodTypeAny>> }> = [];
  for (const [moduleFile, moduleExports] of Object.entries(modules)) {
    for (const [exportName, value] of Object.entries(moduleExports)) {
      if (value instanceof ZodObject) {
        found.push({ moduleFile, schema: value, exportName });
      }
    }
  }
  return found;
}

describe("Zod schemas — strict mode (Phase 5B P1-12)", () => {
  const objectSchemas = collectObjectSchemas();

  it("found a non-trivial number of exported object schemas to check (sanity check the enumeration itself works)", () => {
    // 53 object schemas existed across these 14 files at the time this test
    // was written (including nested sub-schemas) — asserting a floor, not
    // an exact count, so adding new schemas doesn't require touching this
    // number.
    expect(objectSchemas.length).toBeGreaterThanOrEqual(40);
  });

  it.each(objectSchemas.map((s) => [`${s.moduleFile}.${s.exportName}`, s] as const))(
    "%s rejects an unrecognized field",
    (_label, { schema }) => {
      const result = schema.safeParse({ __unexpectedField: "should never be accepted" });
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasUnrecognizedKeysIssue = result.error.issues.some((issue) => issue.code === "unrecognized_keys");
        expect(hasUnrecognizedKeysIssue).toBe(true);
      }
    },
  );
});
