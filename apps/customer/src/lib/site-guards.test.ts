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
    expect(paths.length).toBeGreaterThanOrEqual(5);
    for (const p of paths) {
      const file = p === "/" ? "index" : p.slice(1);
      expect(existsSync(join(site, "src/pages", `${file}.astro`)), p).toBe(true);
    }
  });
  it("published legal content keeps approved neutral Terms and privacy protections", () => {
    for (const page of ["terms", "privacy"]) {
      const wrapper = readFileSync(join(site, `src/pages/${page}.astro`), "utf8");
      expect(wrapper).toContain(`../data/redesign/${page}.html?raw`);
    }
    const t = readFileSync(join(site, "src/data/redesign/terms.html"), "utf8");
    const pr = readFileSync(join(site, "src/data/redesign/privacy.html"), "utf8");
    const faq = readFileSync(join(site, "src/data/redesign/faq.html"), "utf8");
    for (const x of [t, pr]) expect(x).not.toMatch(/lawyer|Not published|DRAFT|Owner to confirm/i);
    expect(t).toContain("For cancellation, refund, pickup, warranty or membership terms, please contact AutoDeck before confirming your booking.");
    expect(t).not.toMatch(/include GST|4 hours|24 hours|Rs 100|20%|30 days|guaranteed/i);
    expect(pr).toContain("Shalin Sheth");
    expect(pr).toContain("autodeckstudio@gmail.com");
    expect(pr).toContain("We do not sell your data");
    expect(pr).toContain("Card and UPI details are handled by Razorpay. We do not store them.");
    expect(pr).toContain("your name and phone, which only the studio sees");
    expect(faq).toContain("any car in your garage");
    expect(faq).toContain("Club plans last 30 days");
    expect(faq).not.toMatch(/car on the plan/i);
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
