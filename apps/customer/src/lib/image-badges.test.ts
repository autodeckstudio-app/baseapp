import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("uploader tiles have remove and replace badges; saved car/RC photos ask before removing (round7 p7)", () => {
  const u = readFileSync("src/ui/inputs.tsx", "utf8");
  expect(u).toContain("'aria-label':multiple?`Remove image ${i+1}`:'Remove image'");
  expect(u).toContain("'aria-label':'Replace image'");
  const g = readFileSync("src/app/(tabs)/garage/[id].tsx", "utf8");
  expect(g).toContain('title="Remove this image?"');
  expect(g).toContain('setRemoveImage("cover")');
  expect(g).toContain('setRemoveImage("rc")');
  expect(readFileSync("src/lib/vehicle-service.ts", "utf8")).toContain('"removeMyVehicleImage"');
  expect(u).toContain("'aria-label':'Remove this image?'");
  expect(u).toContain("onClick:()=>setConfirmIdx(i)");
  expect(readFileSync("src/app/(tabs)/cars/[id].tsx", "utf8")).toContain('title="Remove this image?"');
  expect(readFileSync("src/lib/carsale-service.ts", "utf8")).toContain('"removeMyListingPhoto"');
  expect(readFileSync("src/lib/carsale-service.ts", "utf8")).toContain('"replaceMyListingPhoto"');
  expect(readFileSync("src/app/(tabs)/cars/[id].tsx", "utf8")).toContain('title="Replace this image?"');
});
