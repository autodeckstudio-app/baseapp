import { describe, it, expect } from "vitest";
import { parseSavedJobsView } from "./jobs-view-state";

describe("parseSavedJobsView", () => {
  it("keeps valid values", () => {
    expect(parseSavedJobsView('{"view":"list","when":"","source":"walkin","status":"IN_PROGRESS"}')).toEqual({ view: "list", when: "", source: "walkin", status: "IN_PROGRESS" });
  });
  it("ignores null, non-objects, arrays and bad JSON", () => {
    for (const raw of [null, "null", "7", '"x"', "[1]", "{not json", ""]) expect(parseSavedJobsView(raw)).toEqual({});
  });
  it("drops unknown or wrong-typed fields individually", () => {
    expect(parseSavedJobsView('{"view":"grid","when":3,"source":"booking","status":"ON_HOLD"}')).toEqual({ source: "booking" });
  });
});
