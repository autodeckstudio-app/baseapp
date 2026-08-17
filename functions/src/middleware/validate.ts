import { HttpsError } from "firebase-functions/v2/https";
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
  throw new HttpsError("invalid-argument", formatZodError(result.error));
}

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
}
