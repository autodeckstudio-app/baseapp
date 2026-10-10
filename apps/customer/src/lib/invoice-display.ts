// Pure helpers for invoice display: customer-facing service names, the
// navigation target, and the print-only A4 document. No React, no Firebase.
import { invoiceServiceLabel as serviceLabel, type Invoice } from "@autodeck/core";
import { amountInWords } from "./amount-words";
import { LOGO_HORIZONTAL_SVG, logoDataUri } from "@autodeck/ui/theme";
import { APP_QR_DATA_URI } from "./invoice-qr";

/**
 * Line-item shape. `serviceId` and `serviceName` are OPTIONAL snapshot fields
 * the backend may add (contract assumed, see report). Older invoices only have
 * `description`, which can hold a raw id such as "Service svc-brand-garware-x".
 */
export type InvoiceLine = Invoice["lineItems"][number] & { serviceId?: string | null; serviceName?: string | null };

export { invoiceServiceLabel as serviceLabel } from "@autodeck/core";
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
  appearance?: "screen" | "print";
  invoice: Invoice;
  catalogue: Record<string, string>;
  studio: { name: string; address: string; phone?: string };
  customer?: { name?: string; phone?: string } | null;
  vehicle?: { make: string; model: string; registrationNumber: string } | null;
}

/** Horizon: one document architecture for the dark screen and ivory A4 export. */
export function buildInvoiceHtml({ invoice: inv, catalogue, studio, customer, vehicle, appearance = "print" }: InvoiceDocInput): string {
  const { split, cgst, sgst } = gstSplit(inv);
  const status = inv.status === "void" ? "Void" : inv.status === "paid" ? "Paid" : "Issued";
  const date = inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Not issued";
  const snapshot = inv as unknown as { customerSnapshot?: InvoiceDocInput["customer"]; vehicleSnapshot?: InvoiceDocInput["vehicle"] };
  customer = snapshot.customerSnapshot ?? customer;
  vehicle = snapshot.vehicleSnapshot ?? vehicle;
  const rows = inv.lineItems.map((li, i) => `<tr><td class="svc"><span class="itemno">${String(i + 1).padStart(2, "0")}</span><div><b>${esc(serviceLabel(li, catalogue))}</b><small>${li.quantity} × ${inr(li.unitPrice)}</small></div></td><td class="price">${inr(li.total)}</td></tr>`).join("");
  const tax = split ? `<div><span>CGST 9%</span><b>${inr(cgst)}</b></div><div><span>SGST 9%</span><b>${inr(sgst)}</b></div>` : `<div><span>${esc(inv.taxDescription)}</span><b>${inr(inv.tax)}</b></div>`;
  const discount = inv.discount ? `<div><span>${esc(inv.discountDescription ?? "Discount")}</span><b>- ${inr(inv.discount)}</b></div>` : "";
  const voidNote = inv.status === "void" ? `<p class="void-note">${inv.voidedReason ? `Void reason: ${esc(inv.voidedReason)}` : "This invoice was voided."}</p>` : "";
  const logo = logoDataUri(appearance === "screen" ? LOGO_HORIZONTAL_SVG.replace(/#0B0B0C/g, "#FFFFFF") : LOGO_HORIZONTAL_SVG);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(inv.invoiceNumber)}</title><style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@500;600&display=swap');
@page { size: A4 portrait; margin: 14mm; }
*{box-sizing:border-box}html,body{margin:0;padding:0}body{--bg:#f8f6f0;--ink:#222321;--muted:#73766e;--rule:#dddcd5;--orange:#EC8638;background:var(--bg);color:var(--ink);font:14px/1.5 Inter,Arial,sans-serif;font-variant-numeric:tabular-nums;-webkit-print-color-adjust:exact;print-color-adjust:exact}p,h1,h2,h3{margin:0}b,strong{font-weight:600}.invoice{position:relative;isolation:isolate;overflow:hidden;max-width:794px;min-height:950px;margin:0 auto;padding:0 40px 32px}.hero{position:relative;margin:0 -40px;padding:36px 40px 30px;overflow:hidden;background:linear-gradient(120deg,#f8f6f0 25%,#f7eadc 65%,#efc7a5 100%);border-bottom:1px solid #d9b99a}.orbit{position:absolute;width:500px;height:500px;border:1px solid #e5ad80;border-radius:50%;right:-70px;top:-180px;box-shadow:0 0 0 25px #ec863807,0 0 0 80px #ec863804;pointer-events:none}.brandrow,.titleblock,.metadata,.sectionhead,.summary>div,.total,footer{display:flex;justify-content:space-between;gap:16px}.brandrow{align-items:center;position:relative}.logo{width:205px;height:auto}.pill{font-size:10px;padding:5px 12px;border:1px solid var(--rule);border-radius:30px;color:var(--muted)}.pill:before{content:'•';color:var(--orange);margin-right:7px}.titleblock{position:relative;align-items:flex-end;margin-top:43px}.label,.eyebrow,.sectionhead,.total-label{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--muted)}.eyebrow{margin-bottom:9px}h1{font:600 64px/1.15 Montserrat,Arial,sans-serif;letter-spacing:-.055em}h1 span{color:var(--orange)}.edition{font:500 46px/1 Montserrat;letter-spacing:-.05em;text-align:right;color:#bc783e}.edition small{display:block;font:10px monospace;letter-spacing:.1em;color:var(--muted);margin-top:9px}.edition:after{content:'';display:block;width:54px;height:2px;background:var(--orange);margin:18px 0 0 auto}.metadata{padding:23px 0 18px;border-bottom:1px solid var(--rule);font:12px monospace}.metadata span{display:block;font:10px Inter;color:var(--muted);margin-bottom:8px}.metadata>div:last-child{text-align:right}.metadata b{overflow-wrap:anywhere}.customer{display:grid;grid-template-columns:1fr 1fr;gap:25px;margin:28px 0 34px}.label{margin-bottom:8px}h2{font:600 19px Montserrat;letter-spacing:-.025em}h3{font-size:13px;font-weight:500}.phone,.plate{margin-top:7px;font-size:11px;color:var(--muted)}.plate{font-family:monospace;letter-spacing:.07em}.services{width:100%;border-collapse:collapse}.services thead{display:table-header-group}.services th{text-align:left;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:400;border-bottom:1px solid var(--rule);padding-bottom:12px}.services th:last-child{text-align:right}.services td{padding:20px 0;border-bottom:1px solid var(--rule);vertical-align:top}.services tr{break-inside:avoid;page-break-inside:avoid}.services .svc{display:flex;gap:14px;padding-right:20px}.svc b{font-size:13px;font-weight:500;overflow-wrap:anywhere}.svc small{display:block;color:var(--muted);font-size:11px;margin-top:6px}.itemno{font:10px monospace;color:var(--muted);padding-top:4px}.price{text-align:right;font-size:13px;font-weight:600;white-space:nowrap}.settlement{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin:25px 0}.thanks{font:14px/1.7 Montserrat;letter-spacing:-.025em}.thanks:after{content:'';display:block;width:30px;height:2px;background:var(--orange);margin-top:18px}.summary>div{font-size:12px;margin-bottom:10px}.summary span{color:var(--muted)}.total{align-items:center;background:linear-gradient(110deg,#eae7de,#f1dcc6);padding:22px}.total small{display:block;font-size:10px;color:var(--muted);margin-top:7px}.total strong{font:600 32px Montserrat;letter-spacing:-.045em;color:#9c5725;white-space:nowrap}.closing{break-inside:avoid;page-break-inside:avoid}.words{margin-top:20px;font-size:11px}.words p{margin-top:7px}.void-note{color:#a4412d;font-size:12px;margin-top:20px}footer{align-items:flex-end;margin-top:44px;padding-top:23px;border-top:1px solid var(--rule)}.studio>b{font:500 14px/1.5 Montserrat;letter-spacing:-.025em}.studio em{font-style:normal;color:var(--orange)}.studio p{font-size:10px;line-height:1.8;color:var(--muted);margin-top:14px}.app-link{display:flex;align-items:center;gap:10px;color:var(--ink);font-size:10px;text-decoration:none}.app-link img{width:58px;height:58px;background:white;padding:3px}.app-link small{display:block;font-size:9px;color:var(--muted);margin-top:4px}.watermark{position:absolute;bottom:9px;left:100px;width:560px;opacity:.035;z-index:-1}.screen{--bg:#121413;--ink:#f3f1eb;--muted:#aaaDA5;--rule:#333731}.screen .invoice{min-height:0;padding:0 25px 30px}.screen .hero{margin:0 -25px;padding:28px 25px 22px;background:radial-gradient(ellipse at 105% 0%,#a86028 0%,#3e2d20 37%,#151715 72%);border-bottom-color:#49382a}.screen .orbit{border-color:#eaa26845}.screen .edition{color:#eea570}.screen .total{background:linear-gradient(115deg,#2b2f29,#413426)}.screen .total strong{color:#f0a268}.screen .watermark{opacity:.025}
@media screen and (max-width:599px){.screen .logo{width:170px}.screen .pill{font-size:9px;padding:4px 9px}.screen .titleblock{margin-top:36px}.screen h1{font-size:48px}.screen .eyebrow{font-size:8px;letter-spacing:.1em}.screen .edition{font-size:32px}.screen .edition small{font-size:9px}.screen .orbit{width:330px;height:330px;right:-130px;top:-140px}.screen .metadata{font-size:11px;padding-top:22px;gap:12px}.screen .metadata span{font-size:9px}.screen .customer{grid-template-columns:1fr;gap:22px;margin:27px 0 30px}.screen .svc b,.screen .price{font-size:12px}.screen .svc{gap:9px;padding-right:10px}.screen .svc small{font-size:10px}.screen .services td{padding:18px 0}.screen .settlement{display:block;margin:22px 0 18px}.screen .thanks{display:none}.screen .total{padding:19px 14px;gap:10px}.screen .total strong{font-size:26px}.screen .total-label{font-size:9px;letter-spacing:.07em}.screen .words{font-size:11px}.screen footer{margin-top:31px;align-items:flex-start}.screen .studio>b{font-size:12px}.screen .studio p{font-size:9px}.screen .app-link{flex-direction:column;align-items:flex-end;text-align:right;gap:7px}.screen .app-link img{width:46px;height:46px}.screen .watermark{left:10px;width:340px}}
@media print{body{font-size:10pt}.invoice{padding:0;min-height:260mm;max-width:none;overflow:visible}.hero{margin:0;padding:9mm 8mm 8mm}h1{font-size:43pt}.customer{margin:8mm 0}.closing{margin-top:0}footer{margin-top:12mm}.watermark{max-width:85%;bottom:0}.metadata,.customer,.hero{break-inside:avoid}}
</style></head><body class="${appearance === "screen" ? "screen" : "print"}"><article class="invoice">
<header class="hero"><div class="orbit"></div><div class="brandrow"><img class="logo" src="${logo}" alt="AutoDeck"><span class="pill">${status}</span></div><div class="titleblock"><div><p class="eyebrow">AutoDeck studio / Ahmedabad</p><h1>Invoice<span>.</span></h1></div><div class="edition">${esc(inv.invoiceNumber.split("-").pop()?.replace(/^0+/, "").padStart(2, "0") ?? "")}<small>${esc(inv.invoiceNumber.split("-")[1] ?? "")}</small></div></div></header>
<div class="metadata"><div><span>Invoice number</span><b>${esc(inv.invoiceNumber)}</b></div><div><span>Issued on</span><b>${esc(date)}</b></div></div>
<section class="customer"><div><p class="label">Bill to</p><h2>${esc(customer?.name ?? "Customer")}</h2>${customer?.phone ? `<p class="phone">${esc(customer.phone)}</p>` : ""}</div>${vehicle ? `<div><p class="label">Your vehicle</p><h3>${esc(vehicle.make)} ${esc(vehicle.model)}</h3><p class="plate">${esc(vehicle.registrationNumber)}</p></div>` : ""}</section>
<table class="services"><thead><tr><th>Services</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="closing"><div class="settlement"><div class="thanks"><p class="label">Considered care.</p>Thank you for choosing<br>${esc(studio.name)}.</div><div class="summary"><div><span>Subtotal</span><b>${inr(inv.subtotal)}</b></div>${discount}${tax}</div></div><div class="total"><div><span class="total-label">Total amount</span><small>Inclusive of taxes</small></div><strong>${inr(inv.total)}</strong></div><div class="words"><span class="label">Amount in words</span><p>${esc(amountInWords(inv.total))}</p></div>${voidNote}
<footer><div class="studio"><b>Complete car care.<br><em>All under one roof.</em></b><p>${esc(studio.address)}<br>${studio.phone ? esc(studio.phone) + " · " : ""}@autodeck.studio</p></div><a class="app-link" href="https://app.autodeck.in"><img src="${APP_QR_DATA_URI}" alt="QR code for app.autodeck.in"><div>Your AutoDeck<small>app.autodeck.in</small></div></a></footer></div><img class="watermark" src="${logo}" alt=""></article></body></html>`;
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
    const ready = (frame as unknown as { contentDocument?: { fonts?: { ready: Promise<unknown> }; images?: ArrayLike<{ complete: boolean; addEventListener: (event: string, cb: () => void, opts: object) => void }> } }).contentDocument;
    const images = Array.from(ready?.images ?? []).map((img) => img.complete ? Promise.resolve() : new Promise<void>((resolve) => { img.addEventListener("load", resolve, { once: true }); img.addEventListener("error", resolve, { once: true }); }));
    void Promise.all([ready?.fonts?.ready, ...images]).then(() => { w.focus(); w.print(); setTimeout(() => frame.remove(), 60_000); });
  };
  d.body.appendChild(frame);
}
