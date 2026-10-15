import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { WHATSAPP_CHANNEL_URL, INSTAGRAM_URL } from "./studio-info";
describe("social links", () => {
  it("are the studio's real links", () => {
    expect(WHATSAPP_CHANNEL_URL).toMatch(/^https:\/\/whatsapp\.com\/channel\/\w+$/);
    expect(INSTAGRAM_URL).toBe("https://www.instagram.com/autodeck.studio/");
  });
  it("Home hides a row when its link is empty", () => {
    const h = readFileSync(`${__dirname}/../app/(tabs)/index.tsx`, "utf8");
    expect(h).toContain("WHATSAPP_CHANNEL_URL ?");
    expect(h).toContain("INSTAGRAM_URL ?");
  });
});
