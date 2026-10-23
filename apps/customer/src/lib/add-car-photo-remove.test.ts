import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
// Source guard only (regression evidence): the uploader's Remove badge calls onChange([]), so add-car must clear the photo.
it("add-car clears the picked photo when the uploader sends no file", () => {
  const s = readFileSync("src/app/(tabs)/garage/add.tsx", "utf8");
  expect(s).toMatch(/if \(!file\) \{ setPhoto\(null\);/);
});
