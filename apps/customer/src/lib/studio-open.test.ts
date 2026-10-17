import { describe, expect, it } from "vitest";
import { isOpenNow } from "./studio-info";

const hours = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, open: "10:00", close: "21:00", closed: d === 0 }));
describe("isOpenNow", () => {
  it("is null when hours are unknown", () => { expect(isOpenNow(null, new Date())).toBeNull(); expect(isOpenNow([], new Date())).toBeNull(); });
  it("is true inside opening hours", () => { expect(isOpenNow(hours, new Date(2026, 9, 19, 12, 0))).toBe(true); }); // Monday
  it("is false before opening and after closing", () => {
    expect(isOpenNow(hours, new Date(2026, 9, 19, 9, 59))).toBe(false);
    expect(isOpenNow(hours, new Date(2026, 9, 19, 21, 0))).toBe(false);
  });
  it("is false on a closed day", () => { expect(isOpenNow(hours, new Date(2026, 9, 18, 12, 0))).toBe(false); }); // Sunday
});
