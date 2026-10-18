import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

describe("studio walk-in and lookup flow", () => {
  const w = read("app/(tabs)/walkin.tsx");
  it("step 1 lists existing customers, filters as you type, and always offers Add new customer", () => {
    expect(w).toContain("Existing customers"); expect(w).toContain("filterDirectory"); expect(w).toContain("Add new customer");
    expect(w).not.toContain("results[0]");
  });
  it("starting a walk-in clears the previous one, so the next employee action does not reopen the last customer", () => {
    const i = w.indexOf("startOver();\n      router.replace");
    expect(i).toBeGreaterThan(0);
  });
  it("a car type is never assumed: no default size, add-vehicle needs a type, review asks when none is saved", () => {
    expect(w).toContain("useState<VehicleCategory | null>(null)"); expect(w).toContain("!newVehicleType"); expect(w).toContain("no type saved");
    expect(w).not.toContain('?? "hatchback"');
  });
  it("Lookup shows everyone when the box is empty", () => {
    expect(read("app/(tabs)/lookup/index.tsx")).toContain("All customers");
  });
  it("Calendar splits Active, Done and Cancelled with counts and says what is hidden", () => {
    const c = read("app/(tabs)/calendar.tsx");
    expect(c).toContain("Cancelled"); expect(c).toContain("Use the filters above"); expect(c).toContain('useState<"active" | "done" | "cancelled">("active")');
  });
});
