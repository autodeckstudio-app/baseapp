import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// The bucket CORS allowlist is load-bearing for the signed-URL photo upload
// flows. 2026-10-26 live fixture: browser PUTs failed until
// x-goog-meta-customerId and x-goog-if-generation-match were allowed. A
// deploy script that re-applies the old 3-header config would silently
// re-break uploads, so the required headers are pinned here and in
// scripts/cors.json, and cs-deploy.sh must stay in sync.
const REQUIRED = ["x-goog-meta-customerId", "x-goog-if-generation-match"];
const root = join(__dirname, "../../../..");

describe("bucket CORS guardrail", () => {
  it("scripts/cors.json allows every header the signed-URL flows require", () => {
    const cors = JSON.parse(readFileSync(join(root, "scripts/cors.json"), "utf8"));
    const headers: string[] = cors[0].responseHeader;
    for (const h of REQUIRED) expect(headers).toContain(h);
    expect(cors[0].method).toEqual(expect.arrayContaining(["PUT", "GET", "HEAD"]));
  });

  it("cs-deploy.sh reapplies the same config (cannot silently revert)", () => {
    const script = readFileSync(join(root, "scripts/cs-deploy.sh"), "utf8");
    for (const h of REQUIRED) expect(script).toContain(h);
  });
});
