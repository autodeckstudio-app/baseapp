import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("studio job page confirms in the page", () => {
  const s = readFileSync(new URL("../app/(tabs)/jobs/[id].tsx", import.meta.url).pathname, "utf8");
  it("cash payment steps use an in-page confirm, never a native Alert", () => {
    expect(s).not.toContain("Alert.alert");
    expect(s).toContain("performCashAction");
  });
});
