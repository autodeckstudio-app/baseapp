import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The login screen must not flash back after Google accepts: on success the
// button stays busy until the redirect replaces the page, with a timed release
// so a stuck navigation never leaves sign-in disabled. Errors, MFA and the
// redirect hand-off release it at once.
describe("admin login stays busy after a successful sign-in", () => {
  const src = readFileSync(join(__dirname, "../app/login/page.tsx"), "utf8");
  it("does not clear busy in a finally block after signIn", () => {
    const handler = src.slice(src.indexOf("async function handleGoogle"), src.indexOf("async function handleConfirmCode"));
    expect(handler).not.toContain("finally");
    expect(handler).toContain('outcome === "signed-in"');
    expect(handler).toContain("setTimeout");
  });
  it("releases busy on error", () => {
    const handler = src.slice(src.indexOf("async function handleGoogle"), src.indexOf("async function handleConfirmCode"));
    expect(handler).toMatch(/catch \{[\s\S]*setSubmitting\(false\)/);
  });
});
