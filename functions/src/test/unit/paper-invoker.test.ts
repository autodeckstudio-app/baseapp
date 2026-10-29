import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Transport-reachability guardrail (2026-10-29 incident): updatemypaper and
// deletemypaper went live with EMPTY Cloud Run IAM policies (no bindings at
// all), so every customer call was rejected with a front-door 403 on the CORS
// preflight before the handler ran. finalizeMyPaper survived because it
// declares invoker: "public" explicitly, which makes firebase-tools grant
// allUsers run.invoker on deploy. An undeclared binding is drift nobody can
// see in review, so the declaration is pinned here the same way
// app-check-coverage.test.ts pins enforceAppCheck wiring: by reading the real
// source on disk.
//
// Public transport is NOT public access: both handlers still require a
// signed-in customer with tenant claims and prove document ownership inside
// loadOwnedPaper before any read-driven write, signing, or deletion (covered
// by my-paper-edits.test.ts).
const SRC = join(__dirname, "../../functions/papers/myPaperEdits.ts");

describe("paper edit callables declare public invoker (Oct 29 transport fix)", () => {
  const source = readFileSync(SRC, "utf8");
  it.each(["updateMyPaper", "deleteMyPaper"])("%s opts in to the public invoker explicitly", (name) => {
    const re = new RegExp(`export const ${name} = onCall\\(\\{[^}]*invoker: "public"`);
    expect(source).toMatch(re);
  });
});
