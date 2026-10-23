import { describe, expect, it } from "vitest";
import { buildDocumentList, daysLeftLabel, numberClash, numberKey, paperName } from "./documents";
const d = (id: string, o: Record<string, unknown> = {}) => ({ id, kind: "INSURANCE", reference: `R${id}`, expiresOn: null as string | null, days: null as number | null, ...o });
describe("documents helpers", () => {
  it("OTHER shows its name; an old OTHER without a name still renders", () => {
    expect(paperName({ kind: "OTHER", title: " Warranty card " })).toBe("Warranty card");
    expect(paperName({ kind: "OTHER" })).toBe("Other");
    expect(paperName({ kind: "RC", title: "ignored" })).toBe("Registration Certificate");
  });
  it("number match ignores case and spaces, spans every car, never flags the edited paper, ignores replaced RCs", () => {
    const all = [d("a", { reference: "gj 01 ab 1234" }), d("b", { reference: "POL9", supersededAt: "2026-01-01" })];
    expect(numberKey("gj01ab 1234")).toBe("GJ01AB1234");
    expect(numberClash(all, "GJ01AB1234")).toMatch(/already saved/);
    expect(numberClash(all, "GJ01AB1234", "a")).toBeNull();
    expect(numberClash(all, "POL9")).toBeNull();
    expect(numberClash(all, "  ")).toBeNull();
  });
  it("days-left labels", () => {
    expect(daysLeftLabel(-3)).toBe("Expired");
    expect(daysLeftLabel(0)).toBe("Expires today");
    expect(daysLeftLabel(1)).toBe("1 day left");
    expect(daysLeftLabel(12)).toBe("12 days left");
  });
  it("one list, soonest first, papers and warranties, hides replaced and undated, badge on every row", () => {
    const items = buildDocumentList({
      papers: [d("a", { expiresOn: "2027-03-01", days: 130 }), d("b", { kind: "OTHER", title: "Warranty card", expiresOn: "2026-11-01", days: 9 }), d("c", { expiresOn: "2026-10-01", days: -22 }), d("old", { kind: "RC", expiresOn: "2026-10-30", days: 6, supersededAt: "x" }), d("n", { days: null })],
      warranties: [{ label: "PPF warranty", endDate: "2026-12-01", days: 39 }],
    });
    expect(items.map((i) => i.title)).toEqual(["Insurance", "Warranty card", "PPF warranty", "Insurance"]);
    expect(items.map((i) => i.pill)).toEqual(["Expired", "9 days left", "39 days left", "130 days left"]);
  });
});
