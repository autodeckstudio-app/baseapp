/** An error is not confirmation of cancellation or refund state. Never retry automatically. */
export const CANCELLATION_UNCONFIRMED = "We could not confirm cancellation. Refresh this booking before trying again, or contact the studio.";
export function cancellationErrorMessage(error: unknown): string {
 if(!(error instanceof Error))return CANCELLATION_UNCONFIRMED;
 const code=String((error as Error & {code?:unknown}).code??"").replace(/^functions\//,"").toLowerCase();
 const message=error.message.trim();
 // Preserve only explicit business/authorization guards. Internal, transport
 // and raw transaction failures have uncertain outcomes, not safe retry advice.
 return ["failed-precondition","not-found","permission-denied","resource-exhausted"].includes(code)&&message&&!/^(internal|functions)/i.test(message)?message:CANCELLATION_UNCONFIRMED;
}
