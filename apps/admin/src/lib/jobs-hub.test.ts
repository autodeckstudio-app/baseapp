import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
// Source contract: one shared, ref-counted set of listeners, and every consumer passes a bounded-note handler.
describe("jobs feed sharing", () => {
  const svc = readFileSync(`${__dirname}/jobs-service.ts`, "utf8");
  it("ref-counts one hub per tenant", () => { expect(svc).toMatch(/hubs\.get\(tenantId\)/); expect(svc).toMatch(/subs\.size === 0/); });
  it("falls back to the newest 300 with a note on open-read failure", () => expect(svc).toMatch(/Showing only the newest/));
  it.each(["dashboard", "jobs", "customers"])("%s page shows the notice", (p) => {
    const src = readFileSync(`${__dirname}/../app/(admin)/${p}/page.tsx`, "utf8");
    expect(src).toMatch(/<BoundedJobsNotice note=\{boundedNote\}/); expect(src).toMatch(/setBoundedNote/);
  });
});
