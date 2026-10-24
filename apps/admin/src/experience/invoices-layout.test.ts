import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read = (p: string) => readFileSync(p, "utf8");

describe("invoices list: the Issued badge and the amount can never overlap", () => {
  const views = read("src/experience/OfficeViews.tsx");
  const css = read("src/experience/shell.css");
  const narrow = css.slice(css.indexOf("@media (max-width: 860px)"));
  it("the invoices list opts into its own narrow layout", () => {
    expect(views).toContain('listClassName="ax-list--invoices"');
    expect(read("src/experience/Office.tsx")).toContain("listClassName?: string");
  });
  it("on narrow screens the badge gets its own line and the amount a right-aligned line of its own", () => {
    expect(narrow).toContain('.ax-list--invoices .ax-list-row > [data-col="status"] { grid-column: 1; grid-row: 3; }');
    expect(narrow).toContain('.ax-list--invoices .ax-list-row > [data-col="total"] { grid-column: 2; grid-row: 4; justify-self: end; }');
  });
  it("desktop columns are unchanged", () => {
    expect(views).toContain('{ key: "status", head: "Status", width: "110px", cell: (i) => <StatusBadge label={i.status} /> }');
    expect(views).toContain('{ key: "total", head: "Total", kind: "data", align: "end", width: "120px", cell: (i) => formatPaise(i.total) }');
  });
});
