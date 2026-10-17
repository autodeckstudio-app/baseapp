import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const site = join(__dirname, "../../../site");
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

describe("public site guards", () => {
  it("serves robots.txt and a sitemap that points at it", () => {
    expect(existsSync(join(site, "public/robots.txt"))).toBe(true);
    expect(readFileSync(join(site, "public/robots.txt"), "utf8")).toContain("Sitemap: https://www.autodeck.in/sitemap.xml");
  });
  it("lists only pages that exist", () => {
    const xml = readFileSync(join(site, "public/sitemap.xml"), "utf8");
    const paths = [...xml.matchAll(/<loc>https:\/\/www\.autodeck\.in(\/[^<]*)<\/loc>/g)].map((m) => m[1] as string);
    expect(paths.length).toBeGreaterThan(5);
    for (const p of paths) {
      const file = p === "/" ? "index" : p.slice(1);
      expect(existsSync(join(site, "src/pages", `${file}.astro`)), p).toBe(true);
    }
  });
  it("published legal text matches the approved drafts: no draft or lawyer line, no GST claim, 30-day Club plans", () => {
    const t = readFileSync(join(site, "src/pages/terms.astro"), "utf8");
    const pr = readFileSync(join(site, "src/pages/privacy.astro"), "utf8");
    for (const x of [t, pr]) { expect(x).not.toMatch(/lawyer|Not published|DRAFT|Owner to confirm/i); expect(x).toContain("Shalin Sheth"); }
    expect(t).not.toMatch(/include GST/i); expect(t).toContain("30 days"); expect(t).toContain("autodeckstudio@gmail.com");
  });
  it("the app links Terms and Privacy to the published pages", () => {
    const info = readFileSync(join(__dirname, "studio-info.ts"), "utf8");
    expect(info).toContain('PRIVACY_POLICY_URL = "https://www.autodeck.in/privacy"'); expect(info).toContain('TERMS_URL = "https://www.autodeck.in/terms"');
    expect(readFileSync(join(__dirname, "../ui/LoginStage.tsx"), "utf8")).toContain("LegalLinks");
  });
  it("has privacy and terms pages linked from the footer", () => {
    const base = readFileSync(join(site, "src/layouts/Base.astro"), "utf8");
    for (const p of ["privacy", "terms"]) {
      expect(existsSync(join(site, "src/pages", `${p}.astro`))).toBe(true);
      expect(base).toContain(`href="/${p}"`);
    }
  });
  it("keeps the neighbourhood name to the street address only (brand rule)", () => {
    const bad: string[] = [];
    for (const f of walk(join(site, "src"))) {
      readFileSync(f, "utf8").split("\n").forEach((l, i) => {
        if (/Ellisbridge/.test(l) && !/Sunbeam|Old Sharda/.test(l)) bad.push(`${f}:${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });
});
