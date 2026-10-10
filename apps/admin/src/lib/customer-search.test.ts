import { describe, it, expect } from "vitest";
import { customerMatches, plateIndex, customerIdsForPlate, nationalDigits } from "./customer-search";

const customers = [
  { id: "a", name: "Ashish", phone: "+917043296549", email: "ashish@example.com" },
  { id: "b", name: "AutoDeck Studio", phone: "+919898679711" },
  { id: "c", name: "Meet Sheth", phone: "" , email: "sheth871@gmail.com" },
];
const vehicles = [{ ownerId: "a", registrationNumber: "GJ01 AB 1234" }, { ownerId: "c", registrationNumber: "GJ-05-XY-9" }];
const plates = plateIndex(vehicles);
const find = (q: string) => customers.filter((c) => customerMatches(c, q, plates)).map((c) => c.id);

describe("customer search", () => {
  it("matches name, email, phone variants and plates", () => {
    expect(find("ashish")).toEqual(["a"]);
    expect(find("sheth871@")).toEqual(["c"]);
    expect(find("+91 70432 96549")).toEqual(["a"]);
    expect(find("07043296549")).toEqual(["a"]);
    expect(find("7043296549")).toEqual(["a"]);
    expect(find("96549")).toEqual(["a"]);
    expect(find("9898679711")).toEqual(["b"]);
    expect(find("gj01ab1234")).toEqual(["a"]);
    expect(find("GJ 01 AB")).toEqual(["a"]);
    expect(find("zzz")).toEqual([]);
  });
  it("plate lookup ignores spaces and dashes", () => {
    expect(customerIdsForPlate("gj-01-ab-1234", vehicles)).toEqual(["a"]);
    expect(customerIdsForPlate("GJ", vehicles)).toEqual([]);
  });
  it("national digits", () => { expect(nationalDigits("+91 98986 79711")).toBe("9898679711"); });
});
