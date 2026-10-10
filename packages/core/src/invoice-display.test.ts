import { describe, expect, it } from "vitest";
import { invoiceServiceLabel } from "./invoice-display";
describe("invoiceServiceLabel shared by customer and admin", () => {
  it("prefers historical names to live catalogue", () => expect(invoiceServiceLabel({ serviceName: "Original coating", serviceId: "svc-coating" }, { "svc-coating": "Changed coating" })).toBe("Original coating"));
  it("resolves legacy service descriptions", () => expect(invoiceServiceLabel({ description: "Service svc-brand-garware-ceramic-coating" }, { "svc-brand-garware-ceramic-coating": "Garware Ceramic Coating" })).toBe("Garware Ceramic Coating"));
  it("never leaks missing slug IDs", () => expect(invoiceServiceLabel({ description: "Service svc-brand-garware-ceramic-coating" }, {})).toBe("Garware Ceramic Coating"));
});
