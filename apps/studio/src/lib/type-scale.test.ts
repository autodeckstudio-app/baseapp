import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PHONE_SIZES, PHONE_MAX_WIDTH, desktopTypography, typographyFor, phoneFont } from "@autodeck/ui/tokens";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

describe("phone type scale", () => {
  it("phones get smaller, readable sizes from one table (nothing under 11)", () => {
    const phone = typographyFor(390) as Record<string, { fontSize: number; lineHeight: number }>;
    for (const [k, [size, line]] of Object.entries(PHONE_SIZES)) {
      expect(phone[k]!.fontSize).toBe(size);
      expect(phone[k]!.lineHeight).toBe(line);
      expect(size).toBeLessThanOrEqual((desktopTypography as Record<string, { fontSize: number }>)[k]!.fontSize);
      expect(size).toBeGreaterThanOrEqual(11);
      expect(line).toBeGreaterThan(size);
    }
  });
  it("body copy on a phone is 14", () => {
    expect((typographyFor(390).body as { fontSize: number }).fontSize).toBe(14);
  });
  it("tablet and desktop keep the large sizes", () => {
    expect((typographyFor(820).body as { fontSize: number }).fontSize).toBe(15);
    expect(phoneFont(56, 40, 1280)).toBe(56);
    expect(phoneFont(56, 40, 360)).toBe(40);
    expect(PHONE_MAX_WIDTH).toBe(430);
  });
  it("studio screens never hard-code a font size above 28 without phoneFont", () => {
    const root = join(__dirname, "..");
    const bad: string[] = [];
    for (const f of walk(root)) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/fontSize:\s*(\d+)/g)) if (Number(m[1]) > 28) bad.push(`${f.replace(root, "")}: ${m[0]}`);
    }
    expect(bad).toEqual([]);
  });
});
