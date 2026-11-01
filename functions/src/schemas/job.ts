import { z } from "zod";

const vehicleCategoryEnum = z.enum([
  "hatchback",
  "sedan",
  "suv",
  "luxury",
  "commercial",
  "van",
]);

export const createWalkinJobSchema = z.object({
  serviceId: z.string().min(1),
  vehicleId: z.string().min(1),
  vehicleCategory: vehicleCategoryEnum,
  bayId: z.string().min(1),
  customerId: z.string().min(1),
  studioId: z.string().min(1),
  notes: z.string().max(500).optional(),
}).strict();

export const standbyBookingSchema = z.object({
  jobId: z.string().min(1),
  action: z.enum(["enqueue", "admit"]),
  bayId: z.string().min(1).optional(),
}).strict();

// Staff-declared ACTUAL protection events performed on the job, recorded at
// delivery. Purchasing a protection service is not performing it, so nothing
// here is inferred from the catalog: no declaration, no lifecycle effect, and
// no record is superseded or removed unless a declared event names it. No
// arbitrary count cap - performed work must never be dropped by a limit.
const installSpec = {
  kind: z.enum(["ppf", "ceramic"]),
  coverage: z.enum(["full_body", "full_front", "high_impact"]),
  brand: z.string().trim().min(1).max(80).nullable().optional(),
  warrantyYears: z.number().int().min(0).max(30).nullable().optional(),
};
// Targeted events carry expectedRevision: the revision of the record the
// staff member was looking at when they declared the work. The delivery
// fails closed if the record has moved on since (a stale read must never
// become a lifecycle write), so callers must read the current record before
// declaring. Legacy records without a revision field are revision 0.
const expectedRevision = { expectedRevision: z.number().int().min(0) };
export const protectionWorkEventSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("install"), ...installSpec }).strict(),
  z.object({ action: z.literal("replace"), targetProtectionId: z.string().min(1), ...expectedRevision, ...installSpec }).strict(),
  z.object({ action: z.literal("remove"), targetProtectionId: z.string().min(1), ...expectedRevision }).strict(),
]);

export const advanceJobStatusSchema = z.object({
  jobId: z.string().min(1),
  rework: z.boolean().optional(),
  notes: z.string().max(500).optional(),
  // REQUIRED on the DELIVERED transition, rejected on every other (both
  // enforced in the function): [] means "reviewed - no protection work of
  // any kind", an absent field means the choice was never made.
  protectionWork: z.array(protectionWorkEventSchema).optional(),
}).strict();

export const cancelWalkinJobSchema = z.object({
  jobId: z.string().min(1),
  reason: z.string().trim().min(3).max(300),
}).strict();

export const getStudioJobsSchema = z.object({
  studioId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional(),
}).strict();

export const assignBaySchema = z.object({
  jobId: z.string().min(1),
  bayId: z.string().min(1),
  reason: z.string().max(500).optional(),
}).strict();

export type CreateWalkinJobInput = z.infer<typeof createWalkinJobSchema>;
export type AdvanceJobStatusInput = z.infer<typeof advanceJobStatusSchema>;
export type GetStudioJobsInput = z.infer<typeof getStudioJobsSchema>;
export type AssignBayInput = z.infer<typeof assignBaySchema>;
