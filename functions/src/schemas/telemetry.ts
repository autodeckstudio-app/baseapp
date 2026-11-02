import { z } from "zod";

// First-party web-vitals beacons, one coalesced beacon per page view (never one
// write per metric event). Values are plain performance numbers; page is a
// normalized path only (dynamic IDs replaced client-side, no query string, so
// no tokens/ids ever reach storage).
const metricSchema = z.object({
  value: z.number().finite().min(0).max(3_600_000),
  rating: z.enum(["good", "needs-improvement", "poor"]),
}).strict();

export const recordWebVitalSchema = z.object({
  app: z.enum(["customer", "studio"]),
  page: z.string().min(1).max(200),
  navigationType: z.string().max(40).optional(),
  metrics: z.object({
    CLS: metricSchema.optional(),
    FCP: metricSchema.optional(),
    INP: metricSchema.optional(),
    LCP: metricSchema.optional(),
    TTFB: metricSchema.optional(),
  }).strict().refine((m) => Object.keys(m).length > 0, { message: "at least one metric required" }),
}).strict();
