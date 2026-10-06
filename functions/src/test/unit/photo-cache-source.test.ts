import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
describe("vehicle photo upload identity", () => {
  it("issues a unique object path for each upload rather than overwriting cached bytes", () => {
    const source = readFileSync(join(__dirname, "../../functions/vehicle/issueVehiclePhotoUploadUrl.ts"), "utf8");
    expect(source).toContain("/cover.${randomUUID()}.${EXT[data.contentType]}");
  });
});
