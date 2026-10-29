import { describe, it, expect, vi } from "vitest";
vi.mock("./firebase", () => ({ db: {}, functions: {}, auth: {} }));
vi.mock("firebase/firestore", () => ({ doc: vi.fn(), onSnapshot: vi.fn() }));
vi.mock("firebase/functions", () => ({ httpsCallable: vi.fn() }));
import { inspectionLoadMessage } from "./inspection-service";
describe("inspectionLoadMessage", () => {
  it("missing/unreadable inspection points back to the job, no raw rules text", () => {
    for (const e of [{ code: "permission-denied", message: "Missing or insufficient permissions." }, { message: "evaluation error ... Null value error." }]) {
      const m = inspectionLoadMessage(e); expect(m).toMatch(/Start inspection/); expect(m).not.toMatch(/evaluation error|Null value/);
    }
  });
  it("other errors keep their own message", () => expect(inspectionLoadMessage({ message: "Network down" })).toBe("Network down"));
});
