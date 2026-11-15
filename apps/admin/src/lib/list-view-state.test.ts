import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSavedListView } from "./list-view-state";

describe("saved bookings list view", () => {
  const F = ["status", "date", "serviceId", "search"];
  it("restores saved strings, including an empty date (All dates)", () => {
    expect(parseSavedListView('{"status":"COMPLETED","date":"","serviceId":"","search":"Gauri"}', F)).toEqual({ status: "COMPLETED", date: "", serviceId: "", search: "Gauri" });
  });
  it("ignores bad json, non-objects and wrong types", () => {
    for (const raw of [null, "", "{x", "7", "[1]", "null"]) expect(parseSavedListView(raw, F)).toEqual({});
    expect(parseSavedListView('{"status":3,"search":"a","extra":"z"}', F)).toEqual({ search: "a" });
  });
  it("the list saves when a booking is opened, restores only when returning, and drops a vanished service", () => {
    const rd = readFileSync(`${__dirname}/../app/(admin)/bookings/page.tsx`, "utf8");
    expect(rd).toContain("const open = (id: string) => { saveListView(BOOKINGS_VIEW_KEY");
    expect(rd).toContain("loadReturnedListView(BOOKINGS_VIEW_KEY");
    expect(rd).toContain("clearReturning()");
    expect(rd).toContain("!serviceIds.includes(serviceId)");
    expect(rd).not.toMatch(/useEffect\(\(\) => \{ saveListView/);
  });
});
