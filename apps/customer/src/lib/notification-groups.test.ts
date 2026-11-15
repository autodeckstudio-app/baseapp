import { describe, expect, it } from "vitest";
import { inChip, notificationChip } from "./notification-groups";

describe("notification chips", () => {
  it("groups by entity", () => {
    expect(notificationChip("Booking")).toBe("bookings");
    expect(notificationChip("Warranty")).toBe("papers");
    expect(notificationChip("Membership")).toBe("club");
    expect(notificationChip("Other")).toBeNull();
  });
  it("All keeps everything, others filter", () => {
    const xs = [{ entityType: "Booking" }, { entityType: "Membership" }, { entityType: null }];
    expect(inChip(xs, "all")).toHaveLength(3);
    expect(inChip(xs, "club")).toHaveLength(1);
  });
});
