import { describe, it, expect, vi } from "vitest";
vi.mock("./firebase", () => ({ db: {}, functions: {}, auth: {} }));
vi.mock("firebase/firestore", () => ({ doc: vi.fn(), onSnapshot: vi.fn() }));
vi.mock("firebase/functions", () => ({ httpsCallable: vi.fn() }));
import { inspectionLoadMessage } from "./inspection-service";
describe("inspectionLoadMessage", () => {
  it("missing/unreadable inspection points back to the job, no raw rules text", () => {
    for (const e of [{ code: "permission-denied", message: "Missing or insufficient permissions." }, { message: "evaluation error ... Null value error." }]) {
      const m = inspectionLoadMessage(e); expect(m).toMatch(/Go back to the job/); expect(m).not.toMatch(/tap Start inspection/); expect(m).not.toMatch(/evaluation error|Null value/);
    }
  });
  it("camera/device and other permission-worded errors are not rewritten", () => { for (const m of ["Camera permission was denied", "Photo library permission required", "Network down"]) expect(inspectionLoadMessage({ message: m })).toBe(m); });
  it("other errors keep their own message", () => expect(inspectionLoadMessage({ message: "Network down" })).toBe("Network down"));
});
