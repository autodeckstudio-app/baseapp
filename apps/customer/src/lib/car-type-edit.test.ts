import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
describe("car type can be changed on the edit form", () => {
  it("edit form has a Car type selector and saves category", () => {
    const s = read("app/(tabs)/garage/[id].tsx");
    expect(s).toContain('label="Car type" value={form.category}');
    expect(s).toContain("category: form.category");
  });
});
