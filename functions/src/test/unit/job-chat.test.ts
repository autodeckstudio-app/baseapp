import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
const src = readFileSync(`${__dirname}/../../functions/job/sendJobMessage.ts`, "utf8");
const rules = readFileSync(`${__dirname}/../../../../firestore.rules`, "utf8");
describe("job chat server", () => {
  it("customers can only write on their own job; staff are checked against the studio", () => {
    expect(src).toContain("job.customerId !== user.uid");
    expect(src).toContain("assertStudio(user, job.studioId");
    expect(src).toContain("assertTenant(user, job.tenantId)");
  });
  it("text is cleaned and the chat window is enforced on the server", () => {
    expect(src).toContain("cleanJobMessage");
    expect(src).toContain("canMessageJob");
    expect(src).toContain(".strict()");
  });
  it("is rate limited and only studio replies notify the customer", () => {
    expect(src).toContain('"jobMessage.send"');
    expect(src).toMatch(/!customer && job\.bookingId/);
  });
  it("rules: read for the owner or staff only, never client writes", () => {
    const block = rules.slice(rules.indexOf("match /jobMessages/"), rules.indexOf("match /approvals/"));
    expect(block).toContain("resource.data.customerId == request.auth.uid");
    expect(block).toContain("allow write: if false");
  });
});
