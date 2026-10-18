import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
// Bug found live 18 Oct: in Night the Book button is a light pill, so its label cannot be hard-coded white.
describe("car hero Book button contrast", () => {
  const src = readFileSync(`${__dirname}/../ui/CarHero.tsx`, "utf8");
  it("label colour follows the theme, dark on the light Night pill", () => {
    expect(src).toContain('themeName === "night" ? "#14141A" : "#FFFFFF"');
    expect(src).not.toContain('<Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>Book a service</Text>');
  });
});
