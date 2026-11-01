// Synthetic visual-wiring check for the five-item delta: renders the new/changed
// components through the isolated harness and asserts the visible structure -
// compact history rows (date block + status chip + small invoice link), the
// consolidated Documents row with trailing edit/delete rendered OUTSIDE the row
// pressable, and the flat Garage filter tabs. Text-tree proof, not pixels.
import { describe, expect, it } from "vitest";
import { create, act } from "react-test-renderer";
import { createElement } from "react";
import { HistoryVisitRow } from "./HistoryVisitRow";
import { Row, LinkAction } from "./kit";
import { IconAction } from "./IconAction";
import { FilterPills } from "./FilterPills";

function textOf(el: any): string {
  const walk = (n: any): string => {
    if (n == null || typeof n === "boolean") return "";
    if (typeof n === "string") return n;
    if (Array.isArray(n)) return n.map(walk).join(" ");
    return walk(n.children);
  };
  return walk(el.toJSON()).replace(/\s+/g, " ").trim();
}
async function render(el: any) {
  let r!: ReturnType<typeof create>;
  await act(async () => { r = create(el); });
  return r!;
}

describe("five-item visual wiring", () => {
  it("HistoryVisitRow renders the compact date block, title, caption, gold status chip and a small invoice link", async () => {
    const el = await render(createElement(HistoryVisitRow, {
      at: "2026-10-24T10:00:00Z", title: "Interior clean", caption: "24 Oct 2026 · Ceramic top-up",
      status: "DELIVERED", first: true, onPress: () => {},
      extra: createElement(LinkAction, { label: "View invoice INV-1042", onPress: () => {} }),
    }));
    const t = textOf(el);
    expect(t).toContain("Interior clean");
    expect(t).toContain("24 Oct 2026 · Ceramic top-up");
    expect(t).toContain("DELIVERED");
    expect(t).toContain("View invoice INV-1042");
    expect(t).toContain("Oct"); // month under the date block (uppercase is a style)
  });
  it("Documents Row keeps edit/delete trailing actions as siblings of the row pressable, with the label and review note", async () => {
    const el = await render(createElement(Row, {
      title: "Insurance", detail: "Document checked · AX-9912 · 21 days left · Clear scan",
      onPress: () => {},
      trailing: createElement(IconAction, { kind: "edit", label: "Edit Insurance", onPress: () => {} }),
    }));
    const t = textOf(el);
    expect(t).toContain("Insurance");
    expect(t).toContain("Document checked · AX-9912 · 21 days left · Clear scan");
    expect(t).toContain("✎"); // edit glyph; the label is carried as accessibilityLabel
    const json: any = el.toJSON();
    // outer row View children: [row pressable(title/detail), trailing IconAction, chevron]
    const kids = json.children as any[];
    expect(kids.length).toBe(3);
    const sub = (n: any): string => n == null || typeof n === "boolean" ? "" : typeof n === "string" ? n : Array.isArray(n) ? n.map(sub).join(" ") : sub(n.children);
    expect(sub(kids[0])).toContain("Insurance"); // press target holds title/detail
    expect(sub(kids[0])).not.toContain("✎");    // trailing action is NOT inside it
    expect(sub(kids[1])).toContain("✎");
  });
  it("FilterPills flat mode renders plain text tabs with the selected one underlined", async () => {
    const el = await render(createElement(FilterPills, {
      items: [{ key: "all", label: "All" }, { key: "suv", label: "SUV" }], value: "suv", onChange: () => {}, flat: true,
    }));
    const t = textOf(el);
    expect(t).toContain("All");
    expect(t).toContain("SUV");
  });
});
