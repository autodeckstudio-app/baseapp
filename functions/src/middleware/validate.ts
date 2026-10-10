import { HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import type { ZodSchema, ZodError } from "zod";

/**
 * Validates input data against a Zod schema in strict mode.
 * Returns parsed data or throws HttpsError with structured detail.
 */
export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  // Validation failures reject the request with HTTP 400 before any handler
  // code runs - without this log the rejection is invisible in Cloud Logging
  // (the 10 Oct 2026 membership-approval outage was exactly this blind spot).
  logger.warn("Callable request failed input validation", {
    issues: result.error.issues.map((i) => ({ path: i.path.join("."), code: i.code, message: i.message })),
  });
  throw new HttpsError("invalid-argument", formatZodError(result.error));
}

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
}
