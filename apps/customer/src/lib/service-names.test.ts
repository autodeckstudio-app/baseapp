import { describe, expect, it, vi } from "vitest";
vi.mock("firebase/firestore", () => ({ doc: vi.fn(), getDoc: vi.fn() }));
vi.mock("@autodeck/database", () => ({ COLLECTIONS: { services: () => "services" } }));
vi.mock("./firebase", () => ({ db: {} }));
import { missingNameIds } from "./service-names";

describe("service names", () => {
  it("only asks for ids the catalogue does not already name", () => {
    expect(missingNameIds(["a", "b", "b", ""], { a: "Wash" })).toEqual(["b"]);
  });
});
