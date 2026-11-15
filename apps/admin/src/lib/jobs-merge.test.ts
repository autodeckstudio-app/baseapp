import { describe, it, expect } from "vitest";
import { mergeJobFeeds, timeMs } from "./jobs-merge";
const J = (id: string, createdAt: unknown, status = "DELIVERED", updatedAt?: unknown) => ({ id, createdAt, status, updatedAt }) as never;
const ids = (r: any[]) => r.map((j) => j.id);
describe("mergeJobFeeds", () => {
  it("adds an old open job missing from the newest list, once", () => {
    const r = mergeJobFeeds([J("b", "2026-10-28"), J("a", "2026-10-27")], [[J("old", "2026-01-01", "IN_PROGRESS")], [J("a", "2026-10-27")]]);
    expect(ids(r)).toEqual(["b", "a", "old"]);
  });
  it("handles empty feeds", () => expect(mergeJobFeeds([], [[], []])).toEqual([]));
  it("does not throw on missing, non-string or Timestamp createdAt; unreadable sorts last", () => {
    const ts = { toMillis: () => Date.parse("2026-10-29") };
    const r = mergeJobFeeds([J("a", "2026-10-27")], [[J("none", undefined), J("ts", ts), J("num", 5), J("bad", "x")]]);
    expect(ids(r)).toEqual(["ts", "a", "num", "bad", "none"]);
  });
  it("transition: the copy with the newer updatedAt wins whatever the feed order", () => {
    const oldCopy = J("j", "2026-10-28", "QUALITY_CHECK", "2026-10-29T10:00:00Z");
    const newCopy = J("j", "2026-10-28", "IN_PROGRESS", "2026-10-29T10:05:00Z");
    expect((mergeJobFeeds([], [[oldCopy], [newCopy]])[0] as any).status).toBe("IN_PROGRESS");
    expect((mergeJobFeeds([], [[newCopy], [oldCopy]])[0] as any).status).toBe("IN_PROGRESS");
    expect((mergeJobFeeds([oldCopy], [[newCopy]])[0] as any).status).toBe("IN_PROGRESS");
  });
  it("readable updatedAt beats unreadable; with neither, the first copy is kept deterministically", () => {
    expect((mergeJobFeeds([J("j", "2026-10-28", "A")], [[J("j", "2026-10-28", "B", "2026-10-29T10:00:00Z")]])[0] as any).status).toBe("B");
    expect((mergeJobFeeds([J("j", "2026-10-28", "A")], [[J("j", "2026-10-28", "B")]])[0] as any).status).toBe("A");
  });
  it("timeMs reads strings, numbers, Timestamps and rejects junk", () => {
    expect(timeMs("2026-10-29T00:00:00Z")).toBe(Date.parse("2026-10-29T00:00:00Z"));
    expect(timeMs({ seconds: 2, nanoseconds: 5e6 })).toBe(2005);
    expect(timeMs(null)).toBeNaN(); expect(timeMs({})).toBeNaN();
  });
});
