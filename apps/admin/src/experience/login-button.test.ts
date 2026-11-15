import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Guardrail: stylesheet overrides with !important once turned the login
// button orange after the component was made white. Main buttons are never orange.
describe("admin login button stylesheet", () => {
  it("does not paint the login button orange", () => {
    const css = readFileSync(join(__dirname, "garage.css"), "utf8");
    const rule = css.split("\n").find((l) => l.includes(".ax-login button:not(")) ?? "";
    expect(rule).not.toMatch(/EC8638|F59A45|F9B060/i);
  });
});
