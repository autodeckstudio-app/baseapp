import { z } from "zod";

const kind = z.enum(["RC", "INSURANCE", "PUC", "FASTAG", "OTHER"]);
// Calendar-valid date-only string (YYYY-MM-DD). Checked arithmetically with no Date/timezone
// conversion, so the value is stored exactly as given and cannot shift by timezone.
export function isValidDateOnly(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1]!;
  return d <= days;
}
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
  .refine(isValidDateOnly, "Not a real calendar date");

// New customer submissions no longer offer FASTAG; stored/staff kinds are unchanged.
const customerKind = z.enum(["RC", "INSURANCE", "PUC", "OTHER"]);

// RC number: 2-letter state + 2-digit RTO + 1-2 letter series + 4-digit number, e.g. GJ01AB1234.
export function normalizeRcReference(raw: string): string {
  return raw.toUpperCase().replace(/[\s\-_./]+/g, "");
}
const RC_PATTERN = /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/;

export const submitPaperSchema = z.object({
  studioId: z.string().min(1),
  vehicleId: z.string().min(1),
  kind,
  reference: z.string().min(1).max(120),
  issuedOn: dateString.optional(),
  expiresOn: dateString.optional(),
  evidenceUrl: z.string().url().max(1000).optional(),
  notes: z.string().max(300).optional(),
}).strict();

export const reviewPaperSchema = z.object({
  paperId: z.string().min(1),
  decision: z.enum(["VERIFIED", "REJECTED"]),
  rejectionReason: z.string().trim().min(1).max(300).optional(),
}).strict();

export const updatePaperSchema = z.object({
  paperId: z.string().min(1),
  reference: z.string().min(1).max(120).optional(),
  issuedOn: dateString.nullable().optional(),
  expiresOn: dateString.nullable().optional(),
  evidenceUrl: z.string().url().max(1000).nullable().optional(),
  notes: z.string().max(300).nullable().optional(),
}).strict();

export const listPapersSchema = z.object({
  studioId: z.string().min(1),
  vehicleId: z.string().min(1).optional(),
  status: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
}).strict();

export const submitMyPaperSchema = z.object({
  studioId: z.string().min(1),
  vehicleId: z.string().min(1),
  kind: customerKind,
  reference: z.string().min(1).max(120),
  issuedOn: dateString.optional(),
  expiresOn: dateString.optional(),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
}).strict().transform((v, ctx) => {
  // Insurance, PUC and other references stay free text. Only RC is checked and normalised.
  if (v.kind !== "RC") return v;
  const reference = normalizeRcReference(v.reference);
  if (!RC_PATTERN.test(reference)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reference"],
      message: "RC number must look like GJ01AB1234 (state, RTO, series, number)",
    });
    return z.NEVER;
  }
  return { ...v, reference };
});
