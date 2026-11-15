import { describe, expect, it } from "vitest";
import { clearable, visibleNotifications } from "./notification-hidden";

const DAY = 86_400_000;
const now = Date.parse("2026-10-16T00:00:00Z");
const mk = (id: string, ageDays: number, read: boolean, entityType = "Booking") => ({ id, entityType, readAt: read ? "x" : null, createdAt: new Date(now - ageDays * DAY).toISOString() });

describe("notification tidy-up", () => {
  it("drops read items older than 30 days but keeps unread ones", () => {
    const v = visibleNotifications([mk("old-read", 40, true), mk("old-unread", 40, false), mk("new-read", 2, true)], new Set(), now).map((n) => n.id);
    expect(v).toEqual(["old-unread", "new-read"]);
  });
  it("hides dismissed items on this device", () => {
    expect(visibleNotifications([mk("a", 1, true), mk("b", 1, true)], new Set(["a"]), now).map((n) => n.id)).toEqual(["b"]);
  });
  it("never hides approvals, even old, read or dismissed", () => {
    const a = mk("ap", 90, true, "Approval");
    expect(visibleNotifications([a], new Set(["ap"]), now)).toHaveLength(1);
    expect(clearable([a, mk("x", 1, true)])).toEqual(["x"]);
  });
});
