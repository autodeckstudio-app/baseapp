import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Guard: customer and studio must proxy Firebase's sign-in handler through their
// own host, or iPhone Safari loses the result of a Google redirect sign-in.
const root = join(__dirname, "..", "..", "..");
for (const app of ["customer", "studio"]) {
  describe(`${app} vercel.json`, () => {
    const rewrites: { source: string; destination: string }[] = JSON.parse(
      readFileSync(join(root, app, "vercel.json"), "utf8"),
    ).rewrites;
    it("proxies /__/auth and /__/firebase before the catch-all", () => {
      const sources = rewrites.map((r) => r.source);
      const catchAll = sources.indexOf("/(.*)");
      expect(sources.indexOf("/__/auth/:path*")).toBeGreaterThanOrEqual(0);
      expect(sources.indexOf("/__/auth/:path*")).toBeLessThan(catchAll);
      expect(sources.indexOf("/__/firebase/:path*")).toBeLessThan(catchAll);
    });
    it("points at the live Firebase project", () => {
      expect(rewrites[0]!.destination).toContain("autodeck-studio.firebaseapp.com");
    });
  });
}
