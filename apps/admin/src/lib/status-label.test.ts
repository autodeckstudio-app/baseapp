import { describe, expect, it } from "vitest";
import { statusLabel } from "./status-label";

describe("statusLabel", () => {
  it("names known job states for people", () => {
    expect(statusLabel("READY_FOR_DELIVERY")).toBe("Ready for pickup");
    expect(statusLabel("PENDING_VEHICLE")).toBe("Awaiting vehicle");
  });
  it("sentence-cases unknown values instead of showing raw enums", () => {
    expect(statusLabel("SOME_NEW_STATE")).toBe("Some new state");
  });
  it("handles empty values", () => {
    expect(statusLabel(undefined)).toBe("—");
  });
});
