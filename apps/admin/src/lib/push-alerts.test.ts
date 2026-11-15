import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read = (p: string) => readFileSync(`${__dirname}/../${p}`, "utf8");
describe("staff chat alerts (client)", () => {
  it("the shell shows the alerts button and the worker opens the job page", () => {
    expect(read("experience/StaffShell.tsx")).toContain("<PushAlertsButton />");
    expect(readFileSync(`${__dirname}/../../public/firebase-messaging-sw.js`, "utf8")).toContain('"/jobs/"');
  });
  it("never prompts on its own: only a tap asks for permission", () => {
    const p = read("lib/push.ts");
    expect(p.match(/requestPermission/g)?.length).toBe(1);
    expect(p).toMatch(/export async function syncPushRegistration[\s\S]*pushState\(\) !== "on"/);
  });
});
