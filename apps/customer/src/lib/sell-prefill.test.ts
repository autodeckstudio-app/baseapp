import { describe, expect, it } from "vitest";
import { sellCarLabel, sellPrefillFromVehicle } from "./sell-prefill";

describe("sell prefill from a garage car", () => {
  it("fills make, model, year, colour, km and plate", () => {
    const p = sellPrefillFromVehicle({ make: "Honda", model: "City", year: 2019, color: "White", odometer: 42000, registrationNumber: "GJ01AB1234" });
    expect(p).toEqual({ make: "Honda", model: "City", year: "2019", colour: "White", km: "42000", reg: "GJ01AB1234" });
  });
  it("leaves km empty when the odometer is unknown", () => {
    expect(sellPrefillFromVehicle({ make: "Kia", model: "Seltos", year: 2021, color: "Grey", odometer: null, registrationNumber: "GJ01CD5678" }).km).toBe("");
  });
  it("labels by make and model, falling back to the plate", () => {
    expect(sellCarLabel({ make: "Kia", model: "Seltos", registrationNumber: "X" })).toBe("Kia Seltos");
    expect(sellCarLabel({ make: "", model: "", registrationNumber: "GJ01" })).toBe("GJ01");
  });
});
