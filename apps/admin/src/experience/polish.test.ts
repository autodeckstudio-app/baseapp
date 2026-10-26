import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(`${__dirname}/${p}`, "utf8");

// Layout guardrails for the 26 Oct 2026 admin spacing sweep. Source-level on
// purpose: the failures were cascade bugs (older rules re-styling list rows as
// grey buttons, inputs wider than their card), so the guard pins the rules
// that settle them and the load order that lets them win.
describe("admin layout polish", () => {
  const css = read("polish.css");
  const shell = read("StaffShell.tsx");
  const views = read("OfficeViews.tsx");

  it("loads last so it settles the older layers", () => {
    const order = [...shell.matchAll(/import "\.\/([a-z0-9-]+)\.css";/g)].map((m) => m[1]);
    expect(order[order.length - 1]).toBe("polish");
  });
  it("keeps list rows flat (no grey button fill, no rounded corners)", () => {
    expect(css).toMatch(/\.ax-list-row[^{]*\{[^}]*background: transparent !important[^}]*border-radius: 0 !important/);
  });
  it("keeps lists inside cards from becoming second cards", () => {
    expect(css).toContain(".ax-panel > ul.ax-list");
    expect(css).toContain("padding: 0 !important");
  });
  it("sizes date and time fields to their container and centres their text", () => {
    expect(css).toContain('input[type="datetime-local"]');
    expect(css).toMatch(/align-items: center/);
    expect(css).toContain("max-width: 100%");
    expect(css).toContain("min-width: 0");
  });
  it("keeps placeholder text readable", () => {
    expect(css).toMatch(/::placeholder[^{]*\{[^}]*opacity: 1 !important/);
  });
  it("scopes heading and tile sizing away from the hero (Today) page", () => {
    expect(css).toContain(':not([data-hero="on"]) .ax-page-head h1');
  });
  it("renders refund work as a collapsible bar and leaves its disabled-control copy intact", () => {
    expect(views).toContain('<details className="ax-panel ax-rw"');
    expect(views).toContain("Not yet activated in production - held for activation review");
    expect(views).toContain("!p.actionsEnabled");
  });
  it("gives the payments columns fixed widths that fit a 1180px tablet", () => {
    const widths = [...views.slice(views.indexOf("const cols: Column<Payment>[]"), views.indexOf("if (p.error)", views.indexOf("const cols: Column<Payment>[]"))).matchAll(/width: "(\d+)px"/g)].map((m) => Number(m[1]));
    const fixed = widths.reduce((a, b) => a + b, 0);
    expect(fixed + 96 + 84 + 7 * 12 + 32).toBeLessThanOrEqual(840);
  });
});
