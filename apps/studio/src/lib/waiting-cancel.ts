export function waitingCancellation(booking: { cancelIntent?: { state: string } } | null | undefined): boolean {
  return booking?.cancelIntent?.state === "waiting" || booking?.cancelIntent?.state === "needs_review";
}
