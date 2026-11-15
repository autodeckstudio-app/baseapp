import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("approval notification copy", () => {
  const s = readFileSync(`${__dirname}/../../lib/notification-events.ts`, "utf8");
  it("is calm: a suggestion that needs approval, not a discovery", () => {
    expect(s).not.toContain("We found something");
    expect(s).toContain("It only goes ahead if you approve it in the app.");
  });
});
