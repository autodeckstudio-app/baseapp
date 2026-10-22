/** Message for a failed price lookup, from the real Firebase callable error code (FirebaseError.code). */
export function priceErrorBody(code: string): string {
  if (code === "functions/resource-exhausted") return "Too many price lookups in a short time. Wait a minute, then try again.";
  if (code === "functions/unauthenticated") return "Your sign-in has expired. Sign in again, then retry.";
  return "The studio's price service did not answer. Try again in a moment.";
}
