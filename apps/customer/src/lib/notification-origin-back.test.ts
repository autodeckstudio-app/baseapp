import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
it("a booking opened from Notifications carries returnTo=notifications and Back returns to Notifications", () => {
  const list = read("../app/(tabs)/notifications/index.tsx");
  expect(list).toContain('router.push({ pathname: "/(tabs)/bookings/[id]", params: { id: n.entityId, returnTo: "notifications" } })');
  const detail = read("../app/(tabs)/bookings/[id].tsx");
  expect(detail).toContain('returnTo === "notifications" ? () => router.replace("/(tabs)/notifications") : undefined');
  // Every rendered state of the detail screen hands the same origin-aware Back to Screen.
  expect(detail.split("onBack={originBack}").length - 1).toBeGreaterThanOrEqual(3);
});
