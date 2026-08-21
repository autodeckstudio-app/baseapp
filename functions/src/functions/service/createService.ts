import { onCall } from "firebase-functions/v2/https";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { getFirestore } from "firebase-admin/firestore";
import type { Service } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { createServiceSchema } from "../../schemas/service.js";
import { assertValidMinorUnits } from "../../lib/pricing.js";

export const createService = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  assertTenant(user, user.claims.tenantId);

  const data = validate(createServiceSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "service.create");
  assertValidMinorUnits(data.basePrice, "basePrice");
  const vehicleCategoryPricing = data.vehicleCategoryPricing ?? [];
  for (const rule of vehicleCategoryPricing) {
    assertValidMinorUnits(rule.additionalPricePaise, `vehicleCategoryPricing[${rule.vehicleCategory}].additionalPricePaise`);
  }

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.services()).doc();
  const now = new Date().toISOString();

  const service: Service = {
    id: ref.id,
    tenantId: user.claims.tenantId,
    name: data.name,
    category: data.category,
    brand: data.brand,
    description: data.description,
    basePrice: data.basePrice,
    currency: data.currency ?? "INR",
    estimatedDurationMinutes: data.estimatedDurationMinutes,
    warrantyLabel: data.warrantyLabel,
    warrantyDurationValue: data.warrantyDurationValue ?? null,
    warrantyDurationUnit: data.warrantyDurationUnit ?? null,
    vehicleCategoryPricing,
    requiredBayType: data.requiredBayType ?? "general",
    membershipWashEligible: data.membershipWashEligible ?? false,
    active: true,
    displayOrder: data.displayOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.runTransaction(async (tx) => {
    tx.set(ref, service);
    writeAuditLog(tx, {
      action: "service.created",
      entityType: "Service",
      entityId: ref.id,
      user,
      studioId: null,
      after: { id: ref.id, name: service.name, basePrice: service.basePrice, active: true },
    });
  });

  return { service };
});
