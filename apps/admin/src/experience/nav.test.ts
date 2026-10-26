import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SECTIONS, MORE_LINKS, GROUPS } from "./nav";

const appDir = join(__dirname, "../app/(admin)");
/** Pages kept in the code but taken off every menu (owner, 20 Oct): Gallery. */
const RETIRED = ["/gallery"];
/** Role-only page: reached through homeFor("accountant"), deliberately on no staff menu. */
const ROLE_ONLY = ["/accountant"];
const routes = readdirSync(appDir).filter((n) => statSync(join(appDir, n)).isDirectory()).map((n) => `/${n}`).filter((r) => !RETIRED.includes(r) && !ROLE_ONLY.includes(r));

describe("admin navigation", () => {
  const reachable = new Set([...SECTIONS.flatMap((s) => s.links.map((l) => l.href)), ...MORE_LINKS.map((l) => l.href), ...GROUPS.flatMap((g) => g.links.map((l) => l.href))]);
  it("every page in the app is reachable from the menu (no URL-only pages)", () => {
    expect(routes.filter((r) => !reachable.has(r))).toEqual([]);
  });
  it("every menu link points at a real page", () => {
    expect([...reachable].filter((h) => !routes.includes(h))).toEqual([]);
  });
});

describe("retired pages", () => { it("Gallery is on no menu", () => { expect([...SECTIONS.flatMap((s) => s.links.map((l) => l.href)), ...MORE_LINKS.map((l) => l.href)]).not.toContain("/gallery"); }); });

import { readFileSync } from "node:fs";
describe("menu sheet", () => {
  it("closes when the route changes", () => {
    expect(readFileSync(join(__dirname, "StaffShell.tsx"), "utf8")).toContain("setMoreOpen(false); }, [pathname])");
  });
});

describe("accountant page", () => { it("is on no staff menu", () => { expect([...SECTIONS.flatMap((s) => s.links.map((l) => l.href)), ...MORE_LINKS.map((l) => l.href), ...GROUPS.flatMap((g) => g.links.map((l) => l.href))]).not.toContain("/accountant"); }); });
