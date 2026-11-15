import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = `${__dirname}/../../../..`;
const read = (p: string) => readFileSync(`${root}/${p}`, "utf8");

describe("per-job chat is removed, history is kept", () => {
  it("the send function is gone and not exported", () => {
    expect(existsSync(`${root}/functions/src/functions/job/sendJobMessage.ts`)).toBe(false);
    expect(read("functions/src/index.ts")).not.toContain("sendJobMessage");
  });
  it("neither app renders or imports a chat panel", () => {
    expect(existsSync(`${root}/apps/customer/src/ui/JobChat.tsx`)).toBe(false);
    expect(existsSync(`${root}/apps/admin/src/experience/JobChatPanel.tsx`)).toBe(false);
    expect(read("apps/customer/src/app/(tabs)/bookings/[id].tsx")).not.toMatch(/JobChat/);
    expect(read("apps/admin/src/app/(admin)/jobs/[id]/page.tsx")).not.toMatch(/JobChat/);
  });
  it("old messages are not deleted: the collection and its read rule stay, writes stay denied", () => {
    const rules = read("firestore.rules");
    const block = rules.slice(rules.indexOf("match /jobMessages/"), rules.indexOf("match /approvals/"));
    expect(block).toContain("allow read:");
    expect(block).toContain("allow write: if false");
    expect(read("packages/database/src/collections.ts")).toContain("jobMessages");
  });
});
