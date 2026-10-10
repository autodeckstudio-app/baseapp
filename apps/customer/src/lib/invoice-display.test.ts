import { describe, expect, it } from "vitest";
import type { Invoice } from "@autodeck/core";
import { buildInvoiceHtml, invoiceHref, serviceLabel } from "./invoice-display";

const cat = { "svc-brand-garware-ceramic-coating": "Garware Ceramic Coating", "svc-wash": "Signature Wash" };
const li = (description: string, extra: object = {}) => ({ description, quantity: 1, unitPrice: 100, total: 100, ...extra });

describe("serviceLabel", () => {
  it("prefers the stored snapshot name", () => expect(serviceLabel(li("x", { serviceName: "Snap" }), cat)).toBe("Snap"));
  it("uses serviceId via catalogue", () => expect(serviceLabel(li("x", { serviceId: "svc-wash" }), cat)).toBe("Signature Wash"));
  it("resolves a raw id in the description", () => expect(serviceLabel(li("Service svc-brand-garware-ceramic-coating"), cat)).toBe("Garware Ceramic Coating"));
  it("humanizes an unknown raw id, never shows it raw", () => {
    const s = serviceLabel(li("Service svc-brand-old-thing"), cat);
    expect(s).toBe("Old Thing");
    expect(s).not.toMatch(/svc-/);
  });
  it("keeps a readable description and handles empty", () => {
    expect(serviceLabel(li("Interior detailing"), cat)).toBe("Interior detailing");
    expect(serviceLabel(li(""), {})).toBe("Service");
  });
});

describe("invoiceHref", () => {
  it("targets the exact invoice id, never a vehicle", () => {
    for (const id of ["inv-a", "inv-b"]) {
      const h = invoiceHref(id);
      expect(h.pathname).toBe("/(tabs)/bookings/invoice");
      expect(h.params).toEqual({ invoiceId: id });
    }
  });
});

describe("buildInvoiceHtml", () => {
  const inv = {
    invoiceNumber: "INV-2026-00007", issuedAt: "2026-10-09T10:00:00Z", status: "paid",
    lineItems: Array.from({ length: 40 }, (_, i) => li(i === 0 ? "Service svc-wash" : `Add-on ${i} <b>&</b>`, { total: 10000 })),
    subtotal: 400000, discount: 0, discountDescription: null, taxRatePercent: 18, taxDescription: "GST 18%", tax: 72000, total: 472000,
  } as unknown as Invoice;
  const html = buildInvoiceHtml({ invoice: inv, catalogue: cat, studio: { name: "AutoDeck", address: "Addr" } });
  it("is a real A4 document with every line, escaped, no app chrome", () => {
    expect(html).toContain("size: A4 portrait");
    expect(html).toContain("Signature Wash");
    expect(html).toContain("Add-on 39");
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain("CGST 9%");
    expect(html).not.toMatch(/svc-|<button|Go back|Print or save/);
    expect((html.match(/<tr>/g) ?? []).length).toBe(41);
  });
});
