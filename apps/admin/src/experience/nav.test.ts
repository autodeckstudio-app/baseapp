import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SECTIONS, MORE_LINKS, GROUPS } from "./nav";

const appDir = join(__dirname, "../app/(admin)");
const routes = readdirSync(appDir).filter((n) => statSync(join(appDir, n)).isDirectory()).map((n) => `/${n}`);

describe("admin navigation", () => {
  const reachable = new Set([...SECTIONS.flatMap((s) => s.links.map((l) => l.href)), ...MORE_LINKS.map((l) => l.href), ...GROUPS.flatMap((g) => g.links.map((l) => l.href))]);
  it("every page in the app is reachable from the menu (no URL-only pages)", () => {
    expect(routes.filter((r) => !reachable.has(r))).toEqual([]);
  });
  it("every menu link points at a real page", () => {
    expect([...reachable].filter((h) => !routes.includes(h))).toEqual([]);
  });
});
