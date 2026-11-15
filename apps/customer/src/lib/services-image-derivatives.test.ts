import { it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const manifest = JSON.parse(
  readFileSync(resolve("assets/imagery/optimized/manifest.json"), "utf8"),
) as {
  original: string;
  originalBytes: number;
  originalSHA256: string;
  card: string;
  cardBytes: number;
  detail?: string;
  detailBytes?: number;
}[];
it("optimized images retain exact approved-source provenance and known byte budgets", () => {
  let originals = 0,
    cards = 0;
  expect(manifest).toHaveLength(70);
  for (const row of manifest) {
    const original = readFileSync(resolve(row.original));
    expect(createHash("sha256").update(original).digest("hex")).toBe(
      row.originalSHA256,
    );
    expect(original.length).toBe(row.originalBytes);
    expect(statSync(resolve(row.card)).size).toBe(row.cardBytes);
    if (row.detail)
      expect(statSync(resolve(row.detail)).size).toBe(row.detailBytes);
    originals += row.originalBytes;
    cards += row.cardBytes;
  }
  expect(cards / originals).toBeLessThan(0.15);
});
it("all optimized catalogue requires point to a manifest-listed derivative, never an invented or held source", () => {
  const sources = new Set(
    manifest.flatMap((r) => [r.card, r.detail].filter(Boolean)),
  );
  const text = readFileSync(resolve("src/lib/catalogue-assets.ts"), "utf8");
  for (const match of text.matchAll(
    /require\("\.\.\/\.\.\/(assets\/imagery\/optimized\/[^\"]+)"\)/g,
  ))
    expect(sources.has(match[1])).toBe(true);
  for (const row of manifest)
    expect(row.original).not.toMatch(/HELD|powershield|gen-ppf|gen-pps/);
});
