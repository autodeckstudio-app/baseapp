import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { MENU_GROUPS } from "./menu";

// Confirmed contract: only PPF is priced by car size. No other group blurb may say so.
describe("menu copy does not claim size pricing outside PPF", () => {
  it("wash blurb is flat-price neutral", () => {
    const wash = (MENU_GROUPS as Array<{ key: string; blurb: string }>).find((g) => g.key === "wash");
    expect(wash?.blurb).toBe("Hand washes and interior cleaning.");
  });
  it("site homepage service copy does not say washing is priced by car size", () => {
    const src = readFileSync(new URL("../../../apps/site/src/scripts/home-v2-s12.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/Washing[^\]]*priced by car size/);
  });
});
