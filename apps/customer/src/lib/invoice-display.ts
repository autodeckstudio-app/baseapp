// Pure helpers for invoice display: customer-facing service names, the
// navigation target, and the print-only A4 document. No React, no Firebase.
import type { Invoice } from "@autodeck/core";
import { amountInWords } from "./amount-words";

/**
 * Line-item shape. `serviceId` and `serviceName` are OPTIONAL snapshot fields
 * the backend may add (contract assumed, see report). Older invoices only have
 * `description`, which can hold a raw id such as "Service svc-brand-garware-x".
 */
export type InvoiceLine = Invoice["lineItems"][number] & { serviceId?: string | null; serviceName?: string | null };

const RAW_ID = /\bsvc-[a-z0-9][a-z0-9-]*/i;

function humanizeId(raw: string): string {
  const words = raw.replace(/^svc-/i, "").replace(/^brand-/i, "").split("-").filter(Boolean);
  if (words.length === 0) return "Service";
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/**
 * Customer-facing name for one line. Order: stored snapshot name, catalogue by
 * stored serviceId, catalogue by an id embedded in the description, readable
 * description as written, last resort a humanized id. Never returns a raw id.
 */
export function serviceLabel(li: InvoiceLine, catalogue: Record<string, string>): string {
  const snap = li.serviceName?.trim();
  if (snap) return snap;
  if (li.serviceId && catalogue[li.serviceId]) return catalogue[li.serviceId]!;
  const desc = (li.description ?? "").trim();
  const m = RAW_ID.exec(desc);
  if (m) {
    const hit = catalogue[m[0]] ?? catalogue[m[0].toLowerCase()];
    if (hit) return hit;
    const rest = desc.replace(RAW_ID, "").replace(/^\s*(service)?\s*[:\-]?\s*/i, "").trim();
    return rest.length > 0 && !/^service$/i.test(rest) ? rest : humanizeId(m[0]);
  }
  return desc || "Service";
}

/** The one route every invoice entry point uses: the exact invoice by id. */
export function invoiceHref(invoiceId: string) {
  return { pathname: "/(tabs)/bookings/invoice" as const, params: { invoiceId } };
}

export function gstSplit(inv: Pick<Invoice, "taxRatePercent" | "taxDescription" | "tax">) {
  const split = inv.taxRatePercent === 18 && /gst/i.test(inv.taxDescription) && inv.tax > 0;
  const cgst = split ? Math.floor(inv.tax / 2) : 0;
  return { split, cgst, sgst: split ? inv.tax - cgst : 0 };
}

export function inr(paise: number): string {
  return `\u20B9${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface InvoiceDocInput {
  invoice: Invoice;
  catalogue: Record<string, string>;
  studio: { name: string; address: string; phone?: string };
  customer?: { name?: string; phone?: string } | null;
  vehicle?: { make: string; model: string; registrationNumber: string } | null;
}

/**
 * Print-only invoice document, generated from invoice data. A4 portrait with
 * 16mm print-safe margins, ivory design from round 1, repeating table header,
 * rows and the totals block never split across pages, no app chrome.
 */
export function buildInvoiceHtml({ invoice: inv, catalogue, studio, customer, vehicle }: InvoiceDocInput): string {
  const { split, cgst, sgst } = gstSplit(inv);
  const status = inv.status === "void" ? "Void" : inv.status === "paid" ? "Paid" : "Issued";
  const date = inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-";
  const rows = inv.lineItems
    .map((li) => `<tr><td class="svc">${esc(serviceLabel(li, catalogue))}</td><td class="c">${li.quantity}</td><td class="r">${inr(li.unitPrice)}</td><td class="r b">${inr(li.total)}</td></tr>`)
    .join("");
  const tax = split
    ? `<div class="tr"><span>CGST 9%</span><span>${inr(cgst)}</span></div><div class="tr"><span>SGST 9%</span><span>${inr(sgst)}</span></div>`
    : `<div class="tr"><span>${esc(inv.taxDescription)}</span><span>${inr(inv.tax)}</span></div>`;
  const disc = inv.discount ? `<div class="tr"><span>${esc(inv.discountDescription ?? "Discount")}</span><span>- ${inr(inv.discount)}</span></div>` : "";
  const car = vehicle ? `${esc(vehicle.make)} ${esc(vehicle.model)} - ${esc(vehicle.registrationNumber)}` : "";
  const voidNote = inv.status === "void" ? `<p class="soft">${inv.voidedReason ? `Void reason: ${esc(inv.voidedReason)}` : "This invoice was voided."}</p>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(inv.invoiceNumber)}</title>
<style>
@page { size: A4 portrait; margin: 16mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #FAF6EE; color: #20190F; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 10.5pt; line-height: 1.4; }
.soft { color: #6B6252; } .acc { color: #D96C1F; }
.head { display: flex; justify-content: space-between; gap: 12mm; border-bottom: 0.6mm solid #D96C1F; padding-bottom: 5mm; }
.brand { font-size: 15pt; font-weight: 700; letter-spacing: 0.08em; color: #D96C1F; }
.small { font-size: 9pt; color: #6B6252; max-width: 85mm; }
.title { text-align: right; min-width:0; flex:1; overflow-wrap:anywhere; } .head > div:first-child { flex:1; min-width:0; } .title h1 { margin: 0; font-size: 22pt; letter-spacing: 0.25em; font-weight: 600; }
.lbl { font-size: 8.5pt; letter-spacing: 0.1em; color: #D96C1F; margin: 6mm 0 1mm; }
table { width: 100%; border-collapse: collapse; margin-top: 6mm; }
thead { display: table-header-group; }
th { font-size: 8.5pt; letter-spacing: 0.1em; color: #6B6252; font-weight: 500; text-align: right; padding: 2mm 1mm; border-bottom: 0.3mm solid #E3DACA; }
th.svc { text-align: left; }
td { padding: 2.6mm 1mm; border-bottom: 0.3mm solid #E3DACA; vertical-align: top; }
tr { break-inside: avoid; page-break-inside: avoid; }
td.svc { text-align: left; width: 50%; overflow-wrap: anywhere; } td.c { text-align: center; width: 10%; } td.r { text-align: right; width: 20%; white-space: nowrap; } .b { font-weight: 600; }
.totals { margin: 6mm 0 0 auto; width: 80mm; break-inside: avoid; page-break-inside: avoid; }
.tr { display: flex; justify-content: space-between; padding: 0.8mm 0; } .tr span:first-child { color: #6B6252; }
.grand { border-top: 0.3mm solid #E3DACA; margin-top: 2mm; padding-top: 2mm; display: flex; justify-content: space-between; font-size: 13pt; font-weight: 700; }
.grand span:last-child { color: #D96C1F; }
.words { text-align: right; font-size: 9pt; color: #6B6252; margin-top: 1mm; }
.foot { margin-top: 10mm; border-top: 0.3mm solid #E3DACA; padding-top: 4mm; display: flex; justify-content: space-between; align-items: center; break-inside: avoid; page-break-inside: avoid; }
.pill { border: 0.3mm solid #D96C1F; color: #D96C1F; border-radius: 9999px; padding: 1mm 4mm; font-size: 9pt; letter-spacing: 0.1em; }
</style></head><body>
<div class="head"><div><div class="brand">${esc(studio.name.toUpperCase())}</div><div class="small">${esc(studio.address)}</div>${studio.phone ? `<div class="small">${esc(studio.phone)}</div>` : ""}</div>
<div class="title"><h1>INVOICE</h1><div class="b">${esc(inv.invoiceNumber)}</div><div class="small" style="margin-left:auto">${date}</div></div></div>
<div class="lbl">BILL TO</div><div class="b">${esc(customer?.name ?? "Customer")}</div>${customer?.phone ? `<div class="small">${esc(customer.phone)}</div>` : ""}${car ? `<div class="small">${car}</div>` : ""}
<table><thead><tr><th class="svc">SERVICE</th><th>QTY</th><th>PRICE</th><th>AMOUNT</th></tr></thead><tbody>${rows}</tbody></table>
<div class="totals"><div class="tr"><span>Subtotal</span><span>${inr(inv.subtotal)}</span></div>${disc}${tax}
<div class="grand"><span>Total</span><span>${inr(inv.total)}</span></div><div class="words">${esc(amountInWords(inv.total))}</div></div>
<div class="foot"><span class="soft">Thank you for choosing ${esc(studio.name)}.</span><span class="pill">${status.toUpperCase()}</span></div>${voidNote}
</body></html>`;
}

/** Print the document from a hidden iframe so the app UI can never leak in. */
export function printInvoiceHtml(html: string): void {
  type El = { setAttribute: (k: string, v: string) => void; style: { cssText: string }; srcdoc: string; onload: (() => void) | null; contentWindow: { focus: () => void; print: () => void } | null; remove: () => void };
  const d = (globalThis as unknown as { document?: { createElement: (t: string) => El; body: { appendChild: (e: El) => void } } }).document;
  if (!d) return;
  const frame = d.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  frame.srcdoc = html;
  frame.onload = () => {
    const w = frame.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
    setTimeout(() => frame.remove(), 60_000);
  };
  d.body.appendChild(frame);
}
