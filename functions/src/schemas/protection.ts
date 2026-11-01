import { z } from "zod";

const protectionKindEnum = z.enum(["insurance", "fasttag", "puc", "rc", "extended_warranty", "ppf", "ceramic", "other"]);
// Cosmetic protections a customer may self-declare. Legal/financial kinds stay
// AutoDeck-entered only (createProtection is admin-only).
const customerProtectionKindEnum = z.enum(["ppf", "ceramic"]);
const protectionStatusEnum = z.enum(["unverified", "verified", "expired"]);
// Regex alone accepts impossible dates (2026-02-30); roundtrip through UTC
// to reject anything that is not a real calendar date.
function isCalendarDate(v: string): boolean {
  const [y = 0, m = 0, d = 0] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
  .refine(isCalendarDate, "Must be a real calendar date");
// Whole-year declared warranty length. A number of years alone is NOT an
// expiry: expiry requires a coverage start, which the customer may not know.
const warrantyYears = z.number().int().min(1).max(50);

export const createProtectionSchema = z.object({
  vehicleId: z.string().min(1),
  kind: protectionKindEnum,
  provider: z.string().min(1).max(200).optional(),
  policyNumber: z.string().min(1).max(100).optional(),
  startDate: dateStr.optional(),
  expiryDate: dateStr.optional(),
  warrantyYears: warrantyYears.optional(),
  notes: z.string().max(1000).optional(),
}).strict();

export const updateProtectionSchema = z.object({
  vehicleId: z.string().min(1),
  protectionId: z.string().min(1),
  // Fail-closed staleness: the admin declares the revision they reviewed.
  // A record that moved since (customer edit, delivery event, another
  // correction) rejects the correction instead of silently overwriting it.
  expectedRevision: z.number().int().min(0),
  // Legacy records with NO revision field: the fingerprint (updatedAt) of the
  // exact record the admin reviewed. Required by the function only when the
  // fresh read shows a missing revision; ignored on versioned records.
  legacyBaseUpdatedAt: z.string().min(1).max(100).optional(),
  // Scope repair: the honest path for a cosmetic record whose coverage is
  // missing or wrong (an unknown scope otherwise blocks like-for-like
  // replacement forever). Cosmetic kinds only - enforced in the function.
  coverage: z.enum(["full_body", "full_front", "high_impact"]).nullable().optional(),
  // Null CLEARS an optional field (same semantics as the customer update
  // path): an admin blanking a field means "remove it", and the record shows
  // that honestly instead of silently keeping the old value. Omitting the
  // key leaves the stored value untouched.
  provider: z.string().min(1).max(200).nullable().optional(),
  policyNumber: z.string().min(1).max(100).nullable().optional(),
  startDate: dateStr.nullable().optional(),
  expiryDate: dateStr.nullable().optional(),
  warrantyYears: warrantyYears.nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  status: protectionStatusEnum.optional(),
}).strict();

// Customer self-declare (Add car / edit own entry). No policyNumber, no
// expiryDate, no status: a customer entry is always source "customer" and
// status "unverified", and never carries an invented expiry. Null clears an
// optional field on update.
export const createMyProtectionSchema = z.object({
  vehicleId: z.string().min(1),
  kind: customerProtectionKindEnum,
  // Client-generated stable identity for this declaration (retry dedup): the
  // document id, so a retried or response-lost create returns the same record
  // instead of a duplicate. Multiple declarations of one kind stay possible
  // (distinct ids) - history is never merged away.
  declarationId: z.string().min(8).max(80).regex(/^[A-Za-z0-9_-]+$/, "Invalid declarationId"),
  provider: z.string().min(1).max(200).optional(),
  warrantyYears: warrantyYears.optional(),
  startDate: dateStr.optional(),
  notes: z.string().max(1000).optional(),
}).strict();

export const updateMyProtectionSchema = z.object({
  vehicleId: z.string().min(1),
  protectionId: z.string().min(1),
  // Monotonic-revision precondition: the client must name the revision it
  // based the edit on. A mismatch (including a lost-ack retry after its own
  // write landed) fails truthfully instead of silently applying or silently
  // skipping. null is the explicit repair election and is valid ONLY against
  // a legacy record that has no revision yet.
  expectedRevision: z.number().int().min(1).nullable(),
  // Freshness proof for the legacy repair election: the updatedAt of the
  // legacy record the client actually edited from. Required whenever
  // expectedRevision is null and checked against the stored record inside
  // the write transaction - the null election alone is not proof the
  // caller saw the latest record.
  legacyBaseUpdatedAt: z.string().min(1).max(64).nullable().optional(),
  provider: z.string().min(1).max(200).nullable().optional(),
  warrantyYears: warrantyYears.nullable().optional(),
  startDate: dateStr.nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
}).strict().superRefine((d, ctx) => {
  if (d.expectedRevision === null && !d.legacyBaseUpdatedAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["legacyBaseUpdatedAt"], message: "legacyBaseUpdatedAt is required when expectedRevision is null" });
  }
});
