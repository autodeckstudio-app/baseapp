import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("every plan price shown to customers carries /month (round7 p16)", () => {
  // PlanCompare monthly text is covered by rendered semantic proof in new-candidate-facts.render.test.tsx.
  expect(readFileSync("src/app/(tabs)/membership/purchase.tsx", "utf8")).toContain("/ month");
});
