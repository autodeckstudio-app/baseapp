import { describe, it, expect } from "vitest";
import { carLabel, jobCar } from "./job-people";

describe("job card people", () => {
  it("joins make, model and plate", () => {
    expect(carLabel({ make: "Toyota", model: "Land Cruiser", registrationNumber: "GJ 01 AB 1234" })).toBe("Toyota Land Cruiser \u00b7 GJ 01 AB 1234");
  });
  it("shows what is known when part is missing", () => {
    expect(carLabel({ registrationNumber: "GJ 01 AB 1234" })).toBe("GJ 01 AB 1234");
    expect(carLabel(null)).toBeUndefined();
  });
  it("falls back to the snapshot saved on the job", () => {
    const job = { vehicleId: "v1", vehicleSnapshot: { make: "Kia", model: "Seltos", registrationNumber: "GJ 05 X 1", year: 2020, color: "", photoUrl: null } } as never;
    expect(jobCar(job, {})).toBe("Kia Seltos \u00b7 GJ 05 X 1");
  });
});
