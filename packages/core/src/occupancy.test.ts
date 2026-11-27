import { describe, expect, it } from "vitest";
import { TURNOVER_BUFFER_MINUTES } from "./constants.js";
import {
  bayOccupancy,
  collectionEstimate,
  hasPlannedConflict,
  hasReleaseReceipt,
  isBayFree,
  isPhysicallyPresent,
  physicalHoldSince,
  plannedIntervalsOverlap,
  plannedReservationInterval,
  type OccupancyJob,
} from "./occupancy.js";

const t = (hhmm: string, day = "2027-01-04") => Date.parse(`${day}T${hhmm}:00.000Z`);
const iso = (hhmm: string, day = "2027-01-04") => new Date(t(hhmm, day)).toISOString();

function job(over: Partial<OccupancyJob> & { id: string }): OccupancyJob {
  return {
    bayId: "bay-1",
    status: "PENDING_VEHICLE",
    scheduledAt: iso("09:00"),
    estimatedEndAt: iso("10:00"),
    statusHistory: [],
    ...over,
  };
}
const receipt = { bayReleasedAt: iso("12:00"), bayReleasedBy: "staff-1" };

describe("planned reservations keep the existing 15-minute turnover", () => {
  it("uses the shared constant, which is unchanged at 15 minutes", () => {
    expect(TURNOVER_BUFFER_MINUTES).toBe(15);
  });

  it("occupies [scheduledAt, estimatedEndAt + turnover)", () => {
    expect(plannedReservationInterval(iso("09:00"), iso("10:00"))).toEqual({ startMs: t("09:00"), endMs: t("10:15") });
  });

  it("throws on invalid timestamps or an end before the start instead of under-blocking", () => {
    expect(() => plannedReservationInterval("not-a-date", iso("10:00"))).toThrow(RangeError);
    expect(() => plannedReservationInterval(iso("09:00"), "")).toThrow(RangeError);
    expect(() => plannedReservationInterval(iso("10:00"), iso("09:00"))).toThrow(RangeError);
  });

  it("intervals are start-inclusive and end-exclusive", () => {
    const a = { startMs: t("09:00"), endMs: t("10:15") };
    expect(plannedIntervalsOverlap(a, { startMs: t("10:15"), endMs: t("11:00") })).toBe(false);
    expect(plannedIntervalsOverlap(a, { startMs: t("10:14"), endMs: t("11:00") })).toBe(true);
    expect(plannedIntervalsOverlap({ startMs: t("08:00"), endMs: t("09:00") }, a)).toBe(false);
  });

  it("a new start exactly at the end of the turnover does not conflict; one inside it does", () => {
    const occupied = [plannedReservationInterval(iso("09:00"), iso("10:00"))];
    expect(hasPlannedConflict(t("10:15"), t("11:00"), occupied)).toBe(false);
    expect(hasPlannedConflict(t("10:10"), t("11:00"), occupied)).toBe(true);
  });

  it("the candidate's own turnover must also clear the next booking", () => {
    const occupied = [plannedReservationInterval(iso("09:00"), iso("10:00"))];
    expect(hasPlannedConflict(t("08:00"), t("08:45"), occupied)).toBe(false); // 08:45 + 15 = 09:00
    expect(hasPlannedConflict(t("08:00"), t("08:50"), occupied)).toBe(true); // 08:50 + 15 = 09:05
  });
});

describe("explicit release receipts", () => {
  it("requires an ISO bayReleasedAt string and a non-empty bayReleasedBy string", () => {
    expect(hasReleaseReceipt(receipt)).toBe(true);
    expect(hasReleaseReceipt({ bayReleasedAt: iso("12:00") })).toBe(false);
    expect(hasReleaseReceipt({ bayReleasedAt: iso("12:00"), bayReleasedBy: "" })).toBe(false);
    expect(hasReleaseReceipt({ bayReleasedAt: "yesterday", bayReleasedBy: "staff-1" })).toBe(false);
    expect(hasReleaseReceipt({ bayReleasedAt: { seconds: 1, nanoseconds: 0 }, bayReleasedBy: "staff-1" })).toBe(false);
  });
});

describe("physical occupancy is independent of estimated completion", () => {
  const present = ["VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY", "DELIVERED"];

  it.each(present)("%s with a bay and no release receipt is physically present", (status) => {
    expect(isPhysicallyPresent(job({ id: "j", status }))).toBe(true);
  });

  it("DELIVERED without a release receipt still holds the bay; with a receipt it does not", () => {
    expect(isPhysicallyPresent(job({ id: "j", status: "DELIVERED" }))).toBe(true);
    expect(isPhysicallyPresent(job({ id: "j", status: "DELIVERED", ...receipt }))).toBe(false);
  });

  it("CANCELLED is present only when marked held after cancel; a receipt does not release it (no release path until S5)", () => {
    expect(isPhysicallyPresent(job({ id: "j", status: "CANCELLED" }))).toBe(false);
    expect(isPhysicallyPresent(job({ id: "j", status: "CANCELLED", heldAfterCancelAt: iso("11:00") }))).toBe(true);
    expect(isPhysicallyPresent(job({ id: "j", status: "CANCELLED", heldAfterCancelAt: iso("11:00"), ...receipt }))).toBe(true);
  });

  it("awaiting-vehicle and jobs with no recorded bay (standby, cleared after a recorded move) are not physically present", () => {
    expect(isPhysicallyPresent(job({ id: "j", status: "PENDING_VEHICLE" }))).toBe(false);
    expect(isPhysicallyPresent(job({ id: "j", status: "STANDBY", bayId: "" }))).toBe(false);
    expect(isPhysicallyPresent(job({ id: "j", status: "IN_PROGRESS", bayId: "" }))).toBe(false);
  });

  it("a release receipt is honoured only in READY_FOR_DELIVERY or DELIVERED", () => {
    for (const status of ["VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK"]) {
      expect(isPhysicallyPresent(job({ id: "j", status, ...receipt }))).toBe(true);
    }
    expect(isPhysicallyPresent(job({ id: "j", status: "READY_FOR_DELIVERY", ...receipt }))).toBe(false);
    expect(isPhysicallyPresent(job({ id: "j", status: "DELIVERED", ...receipt }))).toBe(false);
  });

  it("an unknown status fails safely: it throws instead of being treated as unoccupied", () => {
    expect(() => isPhysicallyPresent(job({ id: "j", status: "ON_HOLD" }))).toThrow(RangeError);
    expect(() => isPhysicallyPresent(job({ id: "j", status: "ON_HOLD", bayId: "" }))).toThrow(RangeError);
    expect(() => bayOccupancy([job({ id: "ok", status: "IN_PROGRESS" }), job({ id: "bad", status: "in_progress" })])).toThrow(RangeError);
  });

  it("an estimated completion in the past does not end a hold (overrun)", () => {
    const overrun = job({ id: "j", status: "IN_PROGRESS", scheduledAt: iso("09:00", "2027-01-01"), estimatedEndAt: iso("10:00", "2027-01-01") });
    expect(isPhysicallyPresent(overrun)).toBe(true);
    expect(bayOccupancy([overrun]).holds).toEqual([{ bayId: "bay-1", jobId: "j", sinceMs: null }]);
  });

  it("revising the estimated completion, earlier or later, never releases or changes a hold", () => {
    const base = job({ id: "j", status: "IN_PROGRESS", arrivedAt: iso("08:55"), estimatedEndAt: iso("10:00") });
    const before = bayOccupancy([base]).holds;
    for (const revised of [iso("08:59"), iso("23:00"), iso("09:00", "2027-02-01")]) {
      expect(bayOccupancy([{ ...base, estimatedEndAt: revised }]).holds).toEqual(before);
    }
    expect(before).toHaveLength(1);
  });

  it("only an explicit release receipt ends a hold", () => {
    const held = job({ id: "j", status: "READY_FOR_DELIVERY" });
    expect(bayOccupancy([held]).holds).toHaveLength(1);
    expect(bayOccupancy([{ ...held, ...receipt }]).holds).toHaveLength(0);
  });

  it("hold start comes from arrivedAt, else the first VEHICLE_RECEIVED history entry, else null", () => {
    expect(physicalHoldSince({ arrivedAt: iso("08:50") })).toBe(t("08:50"));
    expect(physicalHoldSince({ statusHistory: [{ status: "PENDING_VEHICLE", changedAt: iso("07:00") }, { status: "VEHICLE_RECEIVED", changedAt: iso("08:52") }] })).toBe(t("08:52"));
    expect(physicalHoldSince({ statusHistory: [] })).toBeNull();
  });
});

describe("planned reservations and physical holds stay separate", () => {
  it("a pending job is a planned reservation only; a present job is a hold only", () => {
    const occ = bayOccupancy([
      job({ id: "pending", bayId: "bay-1" }),
      job({ id: "present", bayId: "bay-2", status: "IN_PROGRESS" }),
      job({ id: "cancelled", bayId: "bay-3", status: "CANCELLED" }),
    ]);
    expect(occ.planned).toEqual([{ bayId: "bay-1", jobId: "pending", interval: { startMs: t("09:00"), endMs: t("10:15") } }]);
    expect(occ.holds.map((h) => h.jobId)).toEqual(["present"]);
  });

  it("a physically held bay is not free for any future window, even long after its estimated completion", () => {
    const occ = bayOccupancy([job({ id: "present", status: "IN_PROGRESS", estimatedEndAt: iso("10:00") })]);
    expect(isBayFree("bay-1", t("11:00"), t("12:00"), occ)).toBe(false);
    expect(isBayFree("bay-1", t("09:00", "2027-03-01"), t("10:00", "2027-03-01"), occ)).toBe(false);
    expect(isBayFree("bay-2", t("11:00"), t("12:00"), occ)).toBe(true);
  });

  it("after an explicit release receipt on completed work the same bay has no recorded occupancy", () => {
    const occ = bayOccupancy([job({ id: "present", status: "READY_FOR_DELIVERY", ...receipt })]);
    expect(isBayFree("bay-1", t("11:00"), t("12:00"), occ)).toBe(true);
  });

  it("a release receipt on an IN_PROGRESS job does not release the bay", () => {
    const occ = bayOccupancy([job({ id: "present", status: "IN_PROGRESS", ...receipt })]);
    expect(occ.holds).toEqual([{ bayId: "bay-1", jobId: "present", sinceMs: null }]);
    expect(isBayFree("bay-1", t("11:00"), t("12:00"), occ)).toBe(false);
  });

  it("an unheld bay is free unless the work and its turnover overlap a planned reservation on that bay", () => {
    const occ = bayOccupancy([job({ id: "pending" })]); // 09:00-10:00 (+15)
    expect(isBayFree("bay-1", t("10:15"), t("11:00"), occ)).toBe(true);
    expect(isBayFree("bay-1", t("10:00"), t("11:00"), occ)).toBe(false);
    expect(isBayFree("bay-2", t("09:30"), t("10:30"), occ)).toBe(true);
  });

  it("malformed planned data throws rather than silently freeing the bay", () => {
    expect(() => bayOccupancy([job({ id: "bad", estimatedEndAt: "nope" })])).toThrow(RangeError);
  });
});

describe("known limitations (pinned so any change to them is deliberate)", () => {
  it("a pause record alone never releases a bay that is still recorded", () => {
    const pause = { at: iso("10:00"), by: "staff-1", fromBayId: "bay-1" };
    const occ = bayOccupancy([job({ id: "j", status: "IN_PROGRESS", bayId: "bay-1", visitBayPause: pause })]);
    expect(occ.holds.map((h) => h.bayId)).toEqual(["bay-1"]);
    expect(isBayFree("bay-1", t("11:00"), t("12:00"), occ)).toBe(false);
    for (const malformed of [false, {}, "", 0]) {
      expect(isPhysicallyPresent(job({ id: "j", status: "IN_PROGRESS", visitBayPause: malformed }))).toBe(true);
    }
  });

  it("only the cleared bayId written with a recorded move removes the hold", () => {
    const paused = job({ id: "j", status: "IN_PROGRESS", bayId: "", visitBayPause: { at: iso("10:00"), by: "staff-1", fromBayId: "bay-1" } });
    expect(bayOccupancy([paused]).holds).toEqual([]);
  });

  it("a changed bayId is NOT proof of a physical move: the hold sits only at the currently recorded bay", () => {
    // The job was recorded in bay-1; an ID-only change (e.g. assignBay) now records bay-2. The job record keeps no
    // previous bay and no move receipt, so this module cannot keep bay-1 held. bay-1 reporting no recorded
    // occupancy below is that limitation, NOT evidence that bay-1 is physically empty.
    const reassigned = job({ id: "j", status: "IN_PROGRESS", bayId: "bay-2" });
    const occ = bayOccupancy([reassigned]);
    expect(occ.holds).toEqual([{ bayId: "bay-2", jobId: "j", sinceMs: null }]);
    expect(isBayFree("bay-1", t("11:00"), t("12:00"), occ)).toBe(true);
  });
});

describe("collection estimate", () => {
  it("is the latest estimated completion among retained services", () => {
    expect(collectionEstimate([
      { estimatedEndAt: iso("11:00"), retained: true },
      { estimatedEndAt: iso("16:30"), retained: true },
      { estimatedEndAt: iso("13:00"), retained: true },
    ])).toBe(iso("16:30"));
  });

  it("ignores services that are not retained, even when they would finish later", () => {
    expect(collectionEstimate([
      { estimatedEndAt: iso("11:00"), retained: true },
      { estimatedEndAt: iso("18:00"), retained: false },
    ])).toBe(iso("11:00"));
  });

  it("works across days and returns a normalised ISO string", () => {
    expect(collectionEstimate([
      { estimatedEndAt: "2027-01-04T09:00:00+05:30", retained: true },
      { estimatedEndAt: iso("12:00", "2027-01-06"), retained: true },
    ])).toBe("2027-01-06T12:00:00.000Z");
  });

  it("is null when no service is retained", () => {
    expect(collectionEstimate([])).toBeNull();
    expect(collectionEstimate([{ estimatedEndAt: iso("11:00"), retained: false }])).toBeNull();
  });

  it("throws on an invalid timestamp in a retained service; ignores one in a removed service", () => {
    expect(() => collectionEstimate([{ estimatedEndAt: "soon", retained: true }])).toThrow(RangeError);
    expect(collectionEstimate([{ estimatedEndAt: "soon", retained: false }, { estimatedEndAt: iso("11:00"), retained: true }])).toBe(iso("11:00"));
  });
});
