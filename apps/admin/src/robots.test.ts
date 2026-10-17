import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "../..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

// Admin and studio logins must not be listed by search engines.
describe("admin and studio are not indexed", () => {
  for (const app of ["admin", "studio"]) {
    it(`${app} serves a real robots.txt that disallows everything`, () => {
      const t = read(`${app}/public/robots.txt`);
      expect(t).toContain("User-agent: *");
      expect(t).toContain("Disallow: /");
      expect(t).not.toMatch(/<html/i);
    });
  }
  it("admin middleware lets robots.txt through (not redirected to /login) and marks pages noindex", () => {
    expect(read("admin/src/middleware.ts")).toContain("robots.txt|");
    expect(read("admin/src/app/layout.tsx")).toContain("robots: { index: false, follow: false }");
  });
  it("studio marks pages noindex in html and header, and keeps robots.txt a real file", () => {
    expect(read("studio/public/index.html")).toContain('name="robots" content="noindex, nofollow"');
    expect(read("studio/vercel.json")).toContain("X-Robots-Tag");
  });
});
