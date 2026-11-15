import { describe, expect, it } from "vitest";
import { buildCarStory } from "./car-story";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

describe("car story", () => {
  it("is absent when the car has no delivered visits and no protection", () => {
    expect(buildCarStory([{ status: "BOOKED" }, { status: "IN_PROGRESS" }], [], fmt)).toBeNull();
  });
  it("counts delivered visits only and dates the story from the earliest sealedAt", () => {
    const s = buildCarStory(
      [
        { status: "DELIVERED", sealedAt: "2026-06-10T10:00:00+05:30" },
        { status: "DELIVERED", sealedAt: "2026-03-02T10:00:00+05:30" },
        { status: "CANCELLED", sealedAt: "2025-01-01T10:00:00+05:30" },
      ],
      [],
      fmt,
    );
    expect(s?.visits).toBe(2);
    expect(s?.since).toBe(fmt("2026-03-02T10:00:00+05:30"));
  });
  it("shows no since date when delivered jobs carry no sealedAt stamp", () => {
    const s = buildCarStory([{ status: "DELIVERED" }], [], fmt);
    expect(s?.visits).toBe(1);
    expect(s?.since).toBeNull();
  });
  it("passes protection records through unchanged", () => {
    const p = [{ title: "Ceramic Coating", detail: "Kovalent · applied 1 Jun 2026" }];
    expect(buildCarStory([], p, fmt)?.protections).toEqual(p);
  });
});
