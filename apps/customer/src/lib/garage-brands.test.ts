import { describe, it, expect } from "vitest";
import type { Vehicle } from "@autodeck/core";
import { garageBrands, garageCarsForBrand } from "./garage-brands";
const cars = [
 { id: "1", make: "Kia", model: "Seltos", year: 2020 },
 { id: "2", make: " kia ", model: "Sonet", year: 2025 },
 { id: "3", make: "BMW", model: "X1" },
 { id: "4", make: "" },
] as Vehicle[];
describe("Garage brand filtering", () => {
 it("deduplicates make case/space, never using model/year", () => expect(garageBrands(cars)).toEqual([{key:"kia",label:"Kia"},{key:"bmw",label:"BMW"},{key:"__unknown_brand__",label:"Other"}]));
 it("includes every same-brand car and preserves list order", () => expect(garageCarsForBrand(cars,"kia").map(c=>c.id)).toEqual(["1","2"]));
 it("All retains every car and unknown makes don't borrow a model", () => { expect(garageCarsForBrand(cars,null)).toBe(cars); expect(garageCarsForBrand(cars,"__unknown_brand__").map(c=>c.id)).toEqual(["4"]); });
});
