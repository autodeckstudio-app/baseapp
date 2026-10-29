import { describe, it, expect } from "vitest";
import { mergeJobFeeds } from "./jobs-merge";
const J = (id: string, createdAt: string, status = "DELIVERED") => ({ id, createdAt, status }) as never;
describe("mergeJobFeeds", () => {
  it("adds an old open job missing from the newest list, once", () => {
    const r = mergeJobFeeds([J("b", "2026-10-28"), J("a", "2026-10-27")], [[J("old", "2026-01-01", "IN_PROGRESS")], [J("a", "2026-10-27")]]);
    expect(r.map((j: any) => j.id)).toEqual(["b", "a", "old"]);
  });
  it("handles empty feeds", () => expect(mergeJobFeeds([], [[], []])).toEqual([]));
});
