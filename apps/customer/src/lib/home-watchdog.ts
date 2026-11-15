/** Watchdog caption shown when no Home source has delivered within 8s of sign-in. */
export const HOME_WATCHDOG_MSG = "This is taking longer than usual. Check your connection and refresh.";

/**
 * Once every source has delivered, a watchdog caption is stale - the data is on
 * screen, so telling the customer to check their connection is wrong. Clear only
 * that caption; a specific listener failure message (failFor) stays visible.
 */
export function clearWatchdogErrorOnDelivery(current: string | null): string | null {
  return current === HOME_WATCHDOG_MSG ? null : current;
}
