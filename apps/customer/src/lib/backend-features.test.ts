import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { PAPER_EDIT_ENABLED, LISTING_PHOTO_EDIT_ENABLED, VEHICLE_IMAGE_REMOVE_ENABLED, paperEditPreviewAllowed } from "./backend-features";
const src = (f: string) => readFileSync(join(__dirname, f), "utf8");
describe("backend availability gates (customer)", () => {
  it("flags are enabled in the same release that deploys their callables", () => {
    expect(PAPER_EDIT_ENABLED).toBe(true);
    expect(LISTING_PHOTO_EDIT_ENABLED).toBe(true);
    expect(VEHICLE_IMAGE_REMOVE_ENABLED).toBe(true);
  });
  it("paper edit/delete affordances stay hidden while updateMyPaper/deleteMyPaper are absent", () => {
    const g = src("../app/(tabs)/garage/[id].tsx");
    expect(g).toContain("trailing={PAPER_EDIT_ENABLED ?");
  });
  it("the dev preview gate needs a dev build AND a verified emulator backend AND the query flag", () => {
    expect(paperEditPreviewAllowed({ devBuild: true, emulatorBackend: true, queryFlag: true })).toBe(true);
    expect(paperEditPreviewAllowed({ devBuild: false, emulatorBackend: true, queryFlag: true })).toBe(false);
    expect(paperEditPreviewAllowed({ devBuild: true, emulatorBackend: false, queryFlag: true })).toBe(false);
    expect(paperEditPreviewAllowed({ devBuild: true, emulatorBackend: true, queryFlag: false })).toBe(false);
    expect(paperEditPreviewAllowed({ devBuild: false, emulatorBackend: false, queryFlag: false })).toBe(false);
  });
  it("the preview gate never opens on a flag alone, and the screen keeps importing the real firebase client", () => {
    // A set EXPO_PUBLIC_USE_FIREBASE_EMULATOR flag without a verified
    // connection must not unlock anything: the gate takes emulatorBackend,
    // not the raw flag, and the screen's only firebase import is the app's
    // own client module.
    const g = src("../app/(tabs)/garage/[id].tsx");
    expect(g).toContain('from "../../../lib/firebase"');
    expect(paperEditPreviewAllowed({ devBuild: true, emulatorBackend: false, queryFlag: true })).toBe(false);
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
  it("choosing RC with one already on file never opens the edit form while updateMyPaper is absent, and never adds a second RC", () => {
    const g = src("../app/(tabs)/garage/[id].tsx");
    expect(g).toContain("if (PAPER_EDIT_ENABLED) { openDocEdit(existingRc); return; }");
    expect(g).toContain("This car already has an RC on file. Editing documents is not available yet.");
  });
});
