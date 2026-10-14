import { describe, it, expect } from "vitest";
import { pickDefaultStudio } from "./default-studio";

describe("pickDefaultStudio", () => {
  const studios = [{ id: "studio-b" }, { id: "studio-a" }];
  it("keeps the studio from the claims", () => {
    expect(pickDefaultStudio("studio-b", "studio", studios)).toBe("studio-b");
  });
  it("gives an admin with no studio the first studio, stably", () => {
    expect(pickDefaultStudio(null, "admin", studios)).toBe("studio-a");
    expect(pickDefaultStudio(null, "superadmin", [...studios].reverse())).toBe("studio-a");
  });
  it("gives studio staff with no studio nothing", () => {
    expect(pickDefaultStudio(null, "studio", studios)).toBeNull();
  });
  it("handles a tenant with no studios", () => {
    expect(pickDefaultStudio(null, "admin", [])).toBeNull();
  });
});
