import { describe, expect, it } from "vitest";
import { historyReportHtml, historyRows } from "./history-report";
const base = { studioName: "AutoDeck", studioAddress: "Ahmedabad", studioPhone: "+91", carTitle: "Kia <Seltos>", plate: "GJ 27", generatedOn: "16 Oct 2026" };
describe("history report", () => {
  it("escapes car text and lists rows", () => {
    const h = historyReportHtml({ ...base, rows: [{ date: "1 Oct", service: "Foam wash", status: "Delivered", invoice: "INV-1" }] });
    expect(h).toContain("Kia &lt;Seltos&gt;");
    expect(h).toContain("Foam wash");
    expect(h).toContain("INV-1");
  });
  it("says so when there are no visits instead of inventing any", () => expect(historyReportHtml({ ...base, rows: [] })).toContain("No completed visits yet."));
  it("only delivered visits are included", () => {
    const r = historyRows([{ id: "a", serviceId: "s", status: "DELIVERED", createdAt: "2026-10-01" }, { id: "b", serviceId: "s", status: "CANCELLED", createdAt: "2026-10-02" }], () => "Wash", (x) => x, () => null);
    expect(r).toHaveLength(1);
  });
});
