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
  inspectedPlate: z.string().trim().min(1).max(30).optional(),
  originalInspected: z.boolean().optional(),
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
  title: z.string().trim().min(1).max(80).optional(),
  issuedOn: dateString.optional(),
  expiresOn: dateString.optional(),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
  // Base64 MD5 of the exact bytes the client will PUT. Required with contentType: it is signed
  // into the upload URL as Content-MD5 (GCS itself rejects different bytes) and recorded in the
  // immutable submission snapshot so finalize can prove the object it checks is the object the
  // client was told to upload.
  contentMd5: z.string().regex(/^[A-Za-z0-9+/]{22}==$/, "contentMd5 must be the base64 MD5 of the file").optional(),
  // Client-generated operation id (one per add-document form session). Lets the server
  // recognize a retry of the SAME submission after a lost acknowledgement and replay it
  // against the record the first attempt created, instead of failing on the reserved number.
  submissionId: z.string().uuid().optional(),
}).strict().transform((v, ctx) => {
  // A photo upload without its content digest cannot be bound: refuse the pair.
  if (v.contentType && !v.contentMd5) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["contentMd5"], message: "contentMd5 is required with contentType" });
    return z.NEVER;
  }
  // An OTHER document needs a name (round 7 point 8). Existing papers without a title still render.
  if (v.kind === "OTHER" && !v.title) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["title"], message: "Give this document a name" });
    return z.NEVER;
  }
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

// Customer edit of their own document: number, expiry, name and photo only. Kind, car and owner never change.
export const updateMyPaperSchema = z.object({
  paperId: z.string().min(1).max(120),
  reference: z.string().min(1).max(120).optional(),
  title: z.string().trim().min(1).max(80).optional(),
  issuedOn: dateString.nullable().optional(),
  expiresOn: dateString.nullable().optional(),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
  contentMd5: z.string().regex(/^[A-Za-z0-9+/]{22}==$/, "contentMd5 must be the base64 MD5 of the file").optional(),
  removePhoto: z.boolean().optional(),
  // Optimistic concurrency: the revision the editing form was opened on. When present, the save
  // commits only if the record is still on exactly that revision; otherwise it aborts and the
  // customer reopens the current state. Optional so older builds keep working unguarded.
  expectedRevision: z.number().int().min(0).optional(),
}).strict().superRefine((v, ctx) => {
  if (v.contentType && !v.contentMd5) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["contentMd5"], message: "contentMd5 is required with contentType" });
  }
});

export const deleteMyPaperSchema = z.object({ paperId: z.string().min(1).max(120), expectedRevision: z.number().int().min(0).optional() }).strict();
