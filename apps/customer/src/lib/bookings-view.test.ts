import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { liveJobOf, recentDistinctServices } from "./bookings-view";

const read = (f: string) => readFileSync(`${__dirname}/../${f}`, "utf8");

describe("bookings view helpers", () => {
  it("finds the job that is in the studio and ignores finished or waiting ones", () => {
    expect(liveJobOf([{ id: "a", status: "DELIVERED" }, { id: "b", status: "PENDING_VEHICLE" }])).toBeNull();
    expect(liveJobOf([{ id: "a", status: "DELIVERED" }, { id: "b", status: "IN_PROGRESS" }])?.id).toBe("b");
  });
  it("returns the last 3 distinct finished services, newest first", () => {
    const b = (id: string, serviceId: string, at: string, status = "COMPLETED") => ({ id, serviceId, scheduledAt: at, status });
    const out = recentDistinctServices([b("1", "s1", "2026-01-01"), b("2", "s2", "2026-02-01"), b("3", "s1", "2026-03-01"), b("4", "s3", "2026-04-01"), b("5", "s4", "2026-05-01"), b("6", "s5", "2026-06-01", "CANCELLED")]);
    expect(out.map((x) => x.serviceId)).toEqual(["s4", "s3", "s1"]);
  });
});

describe("Bookings screen holds only booking content", () => {
  const s = read("app/(tabs)/bookings/index.tsx");
  it("has no Explore, membership, referral or documents blocks", () => {
    for (const w of ["Explore", "Membership", "referral", "Bring a friend", "PhotoCard", "Care map", "papers"]) expect(s).not.toContain(w);
  });
  it("sections come in the agreed order", () => {
    const at = ["In the studio", "Waiting for your OK", "Next booking", "Book again", "History ("].map((k) => s.indexOf(k));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
  it("approvals open the existing approval screen and are never decided inline", () => {
    expect(s).toContain("/(tabs)/approvals/");
    expect(s).not.toContain("respondToApproval");
  });
  it("reschedule and cancel use the shared rules", () => {
    expect(s).toContain("getRescheduleEligibility");
    expect(s).toContain("cancelState");
  });
});
