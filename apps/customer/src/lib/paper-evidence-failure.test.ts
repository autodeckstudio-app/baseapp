import { describe, expect, it, vi } from "vitest";
vi.mock("expo/fetch", () => ({ fetch: vi.fn() }));
vi.mock("firebase/firestore", () => ({ collection: vi.fn(), query: vi.fn(), where: vi.fn(), onSnapshot: vi.fn() }));
vi.mock("firebase/functions", () => ({ httpsCallable: vi.fn() }));
vi.mock("./firebase", () => ({ db: {}, functions: {} }));
import { paperEvidenceFailure } from "./paper-service";

describe("paperEvidenceFailure", () => {
  it("classifies auth/permission codes as permission", () => {
    expect(paperEvidenceFailure({ code: "functions/permission-denied" })).toBe("permission");
    expect(paperEvidenceFailure({ code: "functions/unauthenticated" })).toBe("permission");
    expect(paperEvidenceFailure({ code: "permission-denied" })).toBe("permission");
    expect(paperEvidenceFailure({ code: "unauthenticated" })).toBe("permission");
  });
  it("classifies network/service failures as unavailable", () => {
    expect(paperEvidenceFailure({ code: "functions/unavailable" })).toBe("unavailable");
    expect(paperEvidenceFailure({ code: "functions/internal" })).toBe("unavailable");
    expect(paperEvidenceFailure(new Error("network request failed"))).toBe("unavailable");
    expect(paperEvidenceFailure(null)).toBe("unavailable");
    expect(paperEvidenceFailure(undefined)).toBe("unavailable");
  });
});
