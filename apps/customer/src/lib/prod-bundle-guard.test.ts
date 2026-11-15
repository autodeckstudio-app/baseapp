import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const r = (p: string) => readFileSync(`${__dirname}/../../${p}`, "utf8");

// Guardrail for "dev sample data shipped in the production web bundle". The real check is scripts/prod-bundle-guard.mjs
// against the actual export (run by the Vercel build command); these assertions keep its wiring from being removed.
describe("dev samples stay out of production", () => {
  it("screens load sample modules only under __DEV__ (no static import)", () => {
    for (const p of ["src/app/(tabs)/bookings/[id].tsx", "src/app/(tabs)/garage/index.tsx"]) expect(r(p)).not.toMatch(/^import (?!type ).* from ".*-dev-sample";/m);
    expect(r("src/app/(tabs)/bookings/[id].tsx")).toMatch(/__DEV__ \? .*require\(".*booking-dev-sample"\)/);
    expect(r("src/app/(tabs)/garage/index.tsx")).toContain("dev-garage-loader");
    expect(r("src/lib/dev-garage-loader.ts")).toMatch(/__DEV__\s*\?[\s\S]*require\("\.\/garage-dev-sample"\)/);
  });
  it("metro blocks preview routes and sample modules in production exports", () => {
    const t = r("metro.config.js");
    expect(t).toContain('process.env.NODE_ENV === "production"');
    expect(t).toContain("garage-dev-sample|booking-dev-sample|live-packages-sample");
    expect(t).toContain("preview[^");
  });
  it("the production build runs the bundle guard", () => {
    expect(JSON.parse(r("vercel.json")).buildCommand).toContain("scripts/prod-bundle-guard.mjs");
    expect(r("scripts/prod-bundle-guard.mjs")).toContain("Grand i10");
  });
});
