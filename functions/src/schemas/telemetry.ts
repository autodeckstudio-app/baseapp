import { z } from "zod";

// First-party web-vitals beacons. Values are plain performance numbers; page is a path
// only (no query string, so no tokens/ids in query params ever reach storage).
export const recordWebVitalSchema = z.object({
  app: z.enum(["customer", "studio"]),
  name: z.enum(["CLS", "FCP", "INP", "LCP", "TTFB"]),
  value: z.number().finite().min(0).max(3_600_000),
  rating: z.enum(["good", "needs-improvement", "poor"]),
  page: z.string().min(1).max(200),
  navigationType: z.string().max(40).optional(),
}).strict();
