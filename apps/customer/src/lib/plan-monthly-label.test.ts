import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("every plan price shown to customers carries /month (round7 p16)", () => {
  expect(readFileSync("src/ui/PlanCompare.tsx", "utf8")).toContain("/month</T>");
  expect(readFileSync("src/app/(tabs)/membership/purchase.tsx", "utf8")).toContain("/ month");
});
