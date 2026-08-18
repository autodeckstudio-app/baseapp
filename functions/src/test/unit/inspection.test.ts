import { describe, it, expect } from "vitest";
import { buildInspectionChecklist } from "../../lib/inspection-builder.js";

describe("buildInspectionChecklist", () => {
  it("always includes exterior, glass, and interior sections", () => {
    const checklist = buildInspectionChecklist("other");
    const areas = new Set(checklist.map((i) => i.area));
    expect(areas.has("exterior")).toBe(true);
    expect(areas.has("glass")).toBe(true);
    expect(areas.has("interior")).toBe(true);
  });

  it("adds PPF-specific checks for ppf category", () => {
    const checklist = buildInspectionChecklist("ppf");
    const keys = checklist.map((i) => i.key);
    expect(keys).toContain("existing_film");
    expect(keys).toContain("damaged_film");
    expect(keys).toContain("affected_panels");
  });

  it("adds ceramic-specific checks for ceramic category", () => {
    const checklist = buildInspectionChecklist("ceramic");
    const keys = checklist.map((i) => i.key);
    expect(keys).toContain("existing_coating");
    expect(keys).toContain("water_behavior");
    expect(keys).toContain("surface_contamination");
  });

  it("adds wash-specific checks for washing category", () => {
    const checklist = buildInspectionChecklist("washing");
    const keys = checklist.map((i) => i.key);
    expect(keys).toContain("exterior_condition");
    expect(keys).toContain("interior_condition");
    expect(keys).toContain("special_observations");
  });

  it("categories with no defined service-specific template get only the base sections", () => {
    const inspection = buildInspectionChecklist("inspection");
    const tinting = buildInspectionChecklist("tinting");
    const other = buildInspectionChecklist("other");
    for (const checklist of [inspection, tinting, other]) {
      expect(checklist.every((i) => i.area !== "service_specific")).toBe(true);
    }
  });

  it("every item starts with a null rating and null notes", () => {
    const checklist = buildInspectionChecklist("ppf");
    expect(checklist.every((i) => i.rating === null && i.notes === null)).toBe(true);
  });

  it("item keys within a single checklist are unique", () => {
    const checklist = buildInspectionChecklist("ppf");
    const keys = checklist.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
