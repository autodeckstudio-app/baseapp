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
});
