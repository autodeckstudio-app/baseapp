import { describe, expect, it } from "vitest";
import { validateSellStep, type SellForm } from "./sell-validation";
const form: SellForm = { make: "Maruti Suzuki", model: "Swift", variant: "", year: "2022", km: "0", fuel: "petrol", gearbox: "manual", body: "", owners: "1", colour: "White", area: "Ahmedabad", price: "1000", description: "", name: "QA", phone: "9876543210", reg: "" };
describe("sell field validation", () => {
  it("allows every optional field to be empty and zero mileage", () => {
    for (const step of [0, 1, 2]) expect(validateSellStep(form, step, 1, 2026)).toEqual({});
  });
  it("returns independent required field errors", () => {
    expect(validateSellStep({ ...form, make: "", model: "", year: "2222", km: "", owners: "0", colour: "", area: "" }, 0, 0, 2026)).toMatchObject({ make: expect.any(String), model: expect.any(String), year: expect.any(String), km: expect.any(String), owners: expect.any(String), colour: expect.any(String), area: expect.any(String) });
  });
  it("does not silently turn invalid numbers into valid ones", () => {
    expect(validateSellStep({ ...form, km: "-12", owners: "1x" }, 0, 0).km).toBeTruthy();
    expect(validateSellStep({ ...form, price: "abc1000" }, 1, 0)).toMatchObject({ price: expect.any(String), photos: expect.any(String) });
  });
  it("checks phone and name separately", () => {
    expect(validateSellStep({ ...form, name: "", phone: "123" }, 2, 1)).toMatchObject({ name: expect.any(String), phone: expect.any(String) });
  });
});
