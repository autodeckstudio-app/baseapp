import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CHAT_LIVE } from "./job-chat";
describe("job chat client", () => {
  it("is live now that sendJobMessage, rules and the index are deployed, and keeps its gate", () => {
    expect(CHAT_LIVE).toBe(true);
    const c = readFileSync(`${__dirname}/../ui/JobChat.tsx`, "utf8");
    expect(c).toContain("if (!CHAT_LIVE) return null");
    expect(c).toContain("cleanJobMessage");
  });
  it("is mounted on the booking screen", () => {
    expect(readFileSync(`${__dirname}/../app/(tabs)/bookings/[id].tsx`, "utf8")).toContain("<JobChat");
  });
});
