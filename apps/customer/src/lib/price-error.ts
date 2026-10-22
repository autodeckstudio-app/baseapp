/** What to tell the customer when a price lookup fails, from the real FirebaseError.code of the callable ("functions/<code>"). */
export type PriceErrorInfo = { body: string; retry: boolean };

export function priceErrorInfo(code: string): PriceErrorInfo {
  switch (code) {
    case "functions/resource-exhausted": return { body: "Too many price lookups right now. Wait a bit, then try again.", retry: true };
    case "functions/unauthenticated": return { body: "You need to be signed in to see this price. Sign in again.", retry: false };
    case "functions/permission-denied": return { body: "This account can't see this price. Contact the studio.", retry: false };
    case "functions/not-found": return { body: "This service is no longer on the menu.", retry: false };
    case "functions/failed-precondition": return { body: "This service isn't available to price right now.", retry: false };
    case "functions/invalid-argument": return { body: "Unable to load the price.", retry: false };
    case "functions/unavailable":
    case "functions/deadline-exceeded":
    case "functions/internal": return { body: "Unable to load the price right now. Try again.", retry: true };
    default: return { body: "Unable to load the price.", retry: false };
  }
}
