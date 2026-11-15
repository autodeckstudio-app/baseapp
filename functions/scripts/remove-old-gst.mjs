// One-off, owner-directed (Meet, 19 Oct 2026 10:00 PM): GST is off, so remove the stored GST from ALL old bookings, jobs and invoices.
// Sets tax 0, rate 0, "No tax" and total = total - tax. Never touches payments, subtotals, discounts or fees.
// Saves each original (tax fields and totals) in gstRemovalBackup/{collection}_{id} first, so it can be undone. Dry run unless --apply.
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ projectId: "autodeck-studio" });
const db = getFirestore();
const apply = process.argv.includes("--apply");
const plan = [];
for (const c of ["bookings", "jobs", "invoices"]) {
  for (const d of (await db.collection(c).get()).docs) {
    const x = d.data();
    const pb = c === "invoices" ? x : x.priceBreakdown;
    if (!pb || !(pb.tax > 0)) continue;
    const newTotal = pb.total - pb.tax;
    if (c !== "invoices" && x.totalAmount !== pb.total) throw new Error(`${c}/${d.id}: totalAmount != priceBreakdown.total`);
    if (c !== "invoices" && pb.subtotal !== undefined && newTotal !== pb.subtotal + (pb.pickupFee ?? 0) + (pb.dropFee ?? 0) - (pb.membershipDiscount ?? 0) && newTotal !== pb.subtotal) console.log(`note ${c}/${d.id}: newTotal ${newTotal} vs subtotal ${pb.subtotal}`);
    const orig = c === "invoices"
      ? { tax: x.tax, taxRatePercent: x.taxRatePercent, taxDescription: x.taxDescription, total: x.total }
      : { priceBreakdown: { tax: pb.tax, taxRatePercent: pb.taxRatePercent, taxDescription: pb.taxDescription, total: pb.total }, totalAmount: x.totalAmount };
    const patch = c === "invoices"
      ? { tax: 0, taxRatePercent: 0, taxDescription: "No tax", total: newTotal }
      : { "priceBreakdown.tax": 0, "priceBreakdown.taxRatePercent": 0, "priceBreakdown.taxDescription": "No tax", "priceBreakdown.total": newTotal, totalAmount: newTotal };
    plan.push({ c, id: d.id, ref: d.ref, orig, patch, status: x.status, pay: x.paymentStatus ?? null, paid: x.paymentStatus === "paid" || c === "invoices" });
  }
}
console.log(`${apply ? "APPLY" : "DRY"}: ${plan.length} docs`);
for (const p of plan) console.log(p.c, p.id, p.status, p.pay, `${p.orig.total ?? p.orig.totalAmount} -> ${p.patch.total ?? p.patch.totalAmount}`);
if (apply) {
  for (const p of plan) {
    await db.collection("gstRemovalBackup").doc(`${p.c}_${p.id}`).create({ path: p.ref.path, original: p.orig, removedAt: new Date().toISOString(), reason: "Owner directed 19 Oct 2026: GST off, remove from all old records" });
    await p.ref.update(p.patch);
  }
  console.log("done");
}
