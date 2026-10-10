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

describe("Horizon document", () => {
  const invoice = { invoiceNumber: "INV-2026-00002", issuedAt: "2026-10-10T10:00:00Z", status: "void", lineItems: [li("Service svc-wash")], subtotal: 1200000, discount: 0, taxRatePercent: 18, taxDescription: "GST 18%", tax: 216000, total: 1416000, voidedReason: "Cancelled <script>", customerSnapshot: { name: "Stored customer" }, vehicleSnapshot: { make: "Stored make", model: "Stored model", registrationNumber: "GJ01AA0001" } } as unknown as Invoice;
  it("uses immutable snapshots, original money and real app QR", () => {
    const html = buildInvoiceHtml({ invoice, catalogue: cat, studio: { name: "AutoDeck", address: "Studio" }, customer: { name: "Changed name" } });
    expect(html).toContain("Stored customer");
    expect(html).not.toContain("Changed name");
    expect(html).toContain("Stored make");
    expect(html).toContain("₹14,160.00");
    expect(html).toContain('href="https://app.autodeck.in"');
    expect(html).toContain("QR code for app.autodeck.in");
    expect(html).not.toContain("placeholder");
    expect(html).toContain("Cancelled &lt;script&gt;");
  });
  it("shares the same data and architecture between screen and print", () => {
    const input = { invoice, catalogue: cat, studio: { name: "AutoDeck", address: "Studio" } };
    const screen = buildInvoiceHtml({ ...input, appearance: "screen" });
    const print = buildInvoiceHtml(input);
    expect(screen).toContain('body class="screen"');
    expect(print).toContain('body class="print"');
    for (const html of [screen, print]) { expect(html).toContain("Signature Wash"); expect(html).toContain("₹14,160.00"); expect(html).not.toMatch(/[\u2013\u2014]/); }
  });
});
