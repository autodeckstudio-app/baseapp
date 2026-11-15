import { createHash } from "node:crypto";
import { z } from "zod";
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  id = z.string().min(1).max(128),
  hash = z.string().regex(/^[a-f0-9]{64}$/);
const canonical = (x: unknown) => JSON.stringify(x);
const digest = (x: unknown) =>
  createHash("sha256").update(canonical(x)).digest("hex");
const quote = z
  .object({
    version: z.literal(1),
    bookingId: id,
    jobId: id,
    tenantId: id,
    customerId: id,
    quotedTotalPaise: money,
    pickupFeePaise: money,
    dropFeePaise: money,
    quotedAt: z.string().min(1),
  })
  .strict();
export type ConsultQuoteBinding = z.infer<typeof quote>;
const approval = z
  .object({
    quote: quote,
    quoteHash: hash,
    approvedByCustomerId: id,
    approvedAt: z.string().min(1),
  })
  .strict();
export type ConsultQuoteApproval = z.infer<typeof approval>;
const delta = z
  .object({
    approvalId: id,
    jobId: id,
    tenantId: id,
    customerId: id,
    quoteHash: hash,
    amountPaise: z
      .number()
      .int()
      .min(-Number.MAX_SAFE_INTEGER)
      .max(Number.MAX_SAFE_INTEGER)
      .refine((x) => x !== 0),
    approvedByCustomerId: id,
    approvedAt: z.string().min(1),
  })
  .strict();
export type ConsultApprovedDelta = z.infer<typeof delta>;
/** Pure preparation only. Callers must obtain customer identity/approval and
 * write immutable snapshots in their authoritative transaction. No migration,
 * legacy inferred approval, policy change or callable binding is made here.
 */
export function freezeConsultQuoteApproval(
  raw: unknown,
  customerId: string,
  now: string,
): ConsultQuoteApproval {
  const q = quote.parse(raw);
  if (q.customerId !== customerId)
    throw Error("Exact customer quote approval required");
  return {
    quote: q,
    quoteHash: digest(q),
    approvedByCustomerId: customerId,
    approvedAt: now,
  };
}
export function approvedConsultPaymentBinding(
  rawApproval: unknown,
  rawDeltas: unknown[],
  current: {
    bookingId: string;
    jobId: string;
    tenantId: string;
    customerId: string;
    pickupFeePaise: number;
    dropFeePaise: number;
    totalAmountPaise: number;
  },
) {
  const a = approval.parse(rawApproval),
    q = a.quote,
    ds = rawDeltas.map((x) => delta.parse(x));
  if (
    digest(q) !== a.quoteHash ||
    a.approvedByCustomerId !== q.customerId ||
    q.bookingId !== current.bookingId ||
    q.jobId !== current.jobId ||
    q.tenantId !== current.tenantId ||
    q.customerId !== current.customerId ||
    q.pickupFeePaise !== current.pickupFeePaise ||
    q.dropFeePaise !== current.dropFeePaise ||
    new Set(ds.map((x) => x.approvalId)).size !== ds.length
  )
    throw Error("Current quote approval binding unavailable");
  let total = q.quotedTotalPaise;
  for (const d of ds) {
    if (
      d.quoteHash !== a.quoteHash ||
      d.jobId !== q.jobId ||
      d.tenantId !== q.tenantId ||
      d.customerId !== q.customerId ||
      d.approvedByCustomerId !== q.customerId
    )
      throw Error("Approved work delta binding unavailable");
    total += d.amountPaise;
    if (!Number.isSafeInteger(total))
      throw Error("Approved amount exceeds safe bound");
  }
  if (total <= 0 || total !== current.totalAmountPaise)
    throw Error("Current amount is not customer-approved");
  return {
    amountPaise: total,
    quoteHash: a.quoteHash,
    approvalBindingHash: digest({
      quoteHash: a.quoteHash,
      deltas: ds.sort((left, right) => left.approvalId.localeCompare(right.approvalId)),
    }),
  };
}
