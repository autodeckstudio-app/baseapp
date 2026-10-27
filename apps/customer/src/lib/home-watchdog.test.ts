import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { HOME_WATCHDOG_MSG, clearWatchdogErrorOnDelivery } from "./home-watchdog";

describe("home watchdog caption", () => {
  it("clears the stale watchdog caption once every source has delivered", () => {
    expect(clearWatchdogErrorOnDelivery(HOME_WATCHDOG_MSG)).toBeNull();
  });
  it("keeps a genuine listener failure message after delivery", () => {
    const failure = "We couldn't load everything (cars: permission-denied). Showing what we have.";
    expect(clearWatchdogErrorOnDelivery(failure)).toBe(failure);
  });
  it("leaves an empty error state alone", () => {
    expect(clearWatchdogErrorOnDelivery(null)).toBeNull();
  });
  it("the hook clears the watchdog caption on full delivery and uses the shared message", () => {
    const hook = readFileSync(join(__dirname, "../hooks/useCustomerHome.ts"), "utf8");
    expect(hook).toContain("setError(clearWatchdogErrorOnDelivery)");
    expect(hook).toContain("setError((e) => e ?? HOME_WATCHDOG_MSG)");
  });
});
