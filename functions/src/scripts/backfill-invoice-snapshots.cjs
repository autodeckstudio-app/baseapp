/**
 * One-off, idempotent backfill for invoices issued before Round 2.
 * Adds ONLY non-financial fields: visitId (= jobId), vehicleSnapshot, customerSnapshot,
 * and replaces a legacy "Service <id>" first line-item label with the catalogue name
 * (or the generic "Service" when the catalogue entry is gone). Never changes amounts,
 * numbers, status or line-item counts. Never deletes anything.
 *
 *   node backfill-invoice-snapshots.cjs <tenantId>            # dry run, prints what would change
 *   node backfill-invoice-snapshots.cjs <tenantId> --apply    # writes
 * Uses Admin SDK default credentials (or FIRESTORE_EMULATOR_HOST).
 */
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
const LEGACY = /^Service\s+(?:svc[-_]|[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]*$/i;

(async () => {
  const tenantId = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!tenantId || tenantId.startsWith("--")) throw new Error("tenantId required");
  const snap = await db.collection("invoices").where("tenantId", "==", tenantId).get();
  let changed = 0;
  for (const d of snap.docs) {
    const inv = d.data();
    const patch = {};
    if (!inv.visitId && inv.jobId) patch.visitId = inv.jobId;
    if (!inv.vehicleSnapshot) {
      const v = (await db.collection("vehicles").doc(inv.vehicleId).get()).data();
      let s = v && v.tenantId === tenantId ? v : null;
      if (!s) {
        const j = (await db.collection("jobs").doc(inv.jobId).get()).data();
        s = (j && j.vehicleSnapshot) || null;
        if (!s && j && j.bookingId) s = ((await db.collection("bookings").doc(j.bookingId).get()).data() || {}).vehicleSnapshot || null;
      }
      if (s) patch.vehicleSnapshot = { registrationNumber: s.registrationNumber, make: s.make, model: s.model, year: s.year, color: s.color, photoUrl: s.photoUrl || null };
    }
    if (!inv.customerSnapshot) {
      const c = (await db.collection("customers").doc(inv.customerId).get()).data();
      if (c && c.tenantId === tenantId && c.name && c.name !== "Deleted customer") patch.customerSnapshot = { name: c.name };
    }
    const items = Array.isArray(inv.lineItems) ? inv.lineItems : [];
    if (items[0] && LEGACY.test(String(items[0].description || "").trim())) {
      const job = (await db.collection("jobs").doc(inv.jobId).get()).data();
      const svc = job ? (await db.collection("services").doc(job.serviceId).get()).data() : null;
      const name = svc && svc.tenantId === tenantId && svc.name ? String(svc.name).trim() : "Service";
      patch.lineItems = items.map((li, i) => (i === 0 ? { ...li, description: name, serviceName: name, ...(job ? { serviceId: job.serviceId } : {}) } : li));
    }
    if (Object.keys(patch).length) {
      changed++;
      console.log(apply ? "UPDATE" : "WOULD UPDATE", d.id, Object.keys(patch).join(","));
      if (apply) await d.ref.update(patch);
    }
  }
  console.log(`${apply ? "updated" : "would update"} ${changed} of ${snap.size} invoices`);
})().catch((e) => { console.error(e); process.exit(1); });
