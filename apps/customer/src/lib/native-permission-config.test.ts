import { describe, expect, it } from "vitest";
import config from "../../app.config";
import { readFileSync } from "node:fs";
describe("photo-only native permission policy", () => {
  it("blocks microphone and overlay in reproducible native configuration", () => {
    expect(config.android?.blockedPermissions).toEqual(["android.permission.RECORD_AUDIO", "android.permission.SYSTEM_ALERT_WINDOW"]);
  });
  it("does not block camera or media access used by image selection", () => {
    for (const permission of ["android.permission.CAMERA", "android.permission.READ_EXTERNAL_STORAGE", "android.permission.WRITE_EXTERNAL_STORAGE"]) expect(config.android?.blockedPermissions).not.toContain(permission);
    const picker = readFileSync(new URL("./native-image-pick.ts", import.meta.url), "utf8");
    expect(picker).toContain('mediaTypes: ["images"]');
  });
});
