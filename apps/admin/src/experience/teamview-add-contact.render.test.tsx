import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Basket item 1: the Add form collects name, Google account (email) and a
// contact number; the server parser (staff-admin.ts) already accepts phone.
describe("Team add form collects name, email and contact", () => {
  const src = readFileSync(`${__dirname}/TeamView.tsx`, "utf8");
  it("has a contact number input and passes phone through onAdd", () => {
    expect(src).toContain('type="tel"');
    expect(src).toContain("Contact number (optional)");
    expect(src).toContain("{ phone: phone.trim() }");
  });
  it("email alone grants sign-in (no Aadhaar gate in the add path)", () => {
    expect(src).not.toContain("requiredDocument");
    expect(src).toContain("StaffDocumentReview employeeId={emp.id}");
  });
});
