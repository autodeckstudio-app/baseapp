import { describe, expect, it } from "vitest";
import { openStatus } from "./open-status";
const H = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, open: "10:00", close: d === 0 ? "19:00" : "21:00", closed: false }));
describe("openStatus", () => {
  it("open during hours", () => expect(openStatus(H, [], new Date(2026, 9, 16, 15, 0))).toEqual({ open: true, text: "Open now, until 9 pm" })); // Fri
  it("before opening", () => expect(openStatus(H, [], new Date(2026, 9, 16, 8, 0))?.text).toBe("Closed, opens 10 am"));
  it("after close points to tomorrow", () => expect(openStatus(H, [], new Date(2026, 9, 16, 22, 0))?.text).toBe("Closed, opens tomorrow 10 am"));
  it("Sunday closes at 7 pm", () => expect(openStatus(H, [], new Date(2026, 9, 18, 18, 0))?.text).toBe("Open now, until 7 pm"));
  it("a holiday is closed and skips to the next open day", () => expect(openStatus(H, ["2026-10-16"], new Date(2026, 9, 16, 15, 0))?.text).toBe("Closed, opens tomorrow 10 am"));
  it("unknown hours means no claim", () => { expect(openStatus([], [])).toBeNull(); expect(openStatus(undefined)).toBeNull(); });
});
