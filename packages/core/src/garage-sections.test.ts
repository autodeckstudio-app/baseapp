import { describe, expect, it } from "vitest";
import { GARAGE_SECTIONS, MENU_GROUPS, garageSectionOf } from "./menu.js";

describe("garage sections", () => {
  it("has three sections, with repairs last", () => {
    expect([...GARAGE_SECTIONS]).toEqual(["Health checks", "Wheels and tyres", "Repairs"]);
  });
  it("puts each garage service in its section", () => {
    expect(garageSectionOf("menu-garage-alignment")).toBe("Wheels and tyres");
    expect(garageSectionOf("menu-garage-repairs")).toBe("Repairs");
    expect(garageSectionOf("menu-garage-ac")).toBe("Health checks");
  });
  it("unknown garage services never disappear", () => {
    expect(garageSectionOf("menu-garage-new")).toBe("Health checks");
  });
  it("garage group stays mixed so Repairs can be quote only", () => {
    expect(MENU_GROUPS.find((g) => g.key === "garage")?.pricing).toBe("mixed");
  });
});
