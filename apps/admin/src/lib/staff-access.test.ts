import { describe, expect, it } from "vitest";
import { canVisit, homeFor, isStudioPath } from "./staff-access";

describe("staff access", () => {
  it("keeps studio staff on studio routes", () => {
    expect(canVisit("studio", "/jobs")).toBe(true);
    expect(canVisit("studio", "/jobs/abc")).toBe(true);
    expect(canVisit("studio", "/bookings")).toBe(true);
    expect(canVisit("studio", "/payments")).toBe(false);
    expect(canVisit("studio", "/staff")).toBe(false);
    expect(canVisit("studio", "/jobsx")).toBe(false);
  });
  it("lets admins everywhere", () => {
    expect(canVisit("admin", "/payments")).toBe(true);
    expect(canVisit("superadmin", "/staff")).toBe(true);
  });
  it("never lets customers in", () => {
    expect(canVisit("customer", "/jobs")).toBe(false);
  });
  it("sends each role home", () => {
    expect(homeFor("studio")).toBe("/jobs");
    expect(homeFor("admin")).toBe("/dashboard");
    expect(isStudioPath("/bookings/1")).toBe(true);
  });
});
