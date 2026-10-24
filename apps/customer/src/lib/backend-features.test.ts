import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { PAPER_EDIT_ENABLED, LISTING_PHOTO_EDIT_ENABLED, VEHICLE_IMAGE_REMOVE_ENABLED } from "./backend-features";
const src = (f: string) => readFileSync(join(__dirname, f), "utf8");
describe("backend availability gates (customer)", () => {
  it("flags stay false until their callables deploy", () => {
    expect(PAPER_EDIT_ENABLED).toBe(false);
    expect(LISTING_PHOTO_EDIT_ENABLED).toBe(false);
    expect(VEHICLE_IMAGE_REMOVE_ENABLED).toBe(false);
  });
  it("paper edit/delete affordances stay hidden while updateMyPaper/deleteMyPaper are absent", () => {
    const g = src("../app/(tabs)/garage/[id].tsx");
    expect(g).toContain("trailing={PAPER_EDIT_ENABLED ?");
  });
  it("car photo removal stays hidden while removeMyVehicleImage is absent", () => {
    const g = src("../app/(tabs)/garage/[id].tsx");
    expect(g).toContain("VEHICLE_IMAGE_REMOVE_ENABLED && vehicle.photoUrl");
    expect(g).toContain("VEHICLE_IMAGE_REMOVE_ENABLED && vehicle.rcPhotoUrl");
  });
  it("listing photo remove/replace stays hidden while its callables are absent", () => {
    const c = src("../app/(tabs)/cars/[id].tsx");
    expect(c).toContain("LISTING_PHOTO_EDIT_ENABLED && car.mine");
  });
});
