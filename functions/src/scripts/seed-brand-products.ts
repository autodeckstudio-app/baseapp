/**
 * Seeds brand-site products (XPEL, Garware, LLumar, 3M, Kovalent, Fireball) as bookable services
 * with priceOnRequest = true. Facts come from each brand's own site (see brand-data.ts). No price is
 * invented: basePrice is 0 and the studio sets the real price per booking via setBookingQuote.
 * estimatedDurationMinutes (480) is only a scheduling placeholder for a one-day slot; the studio adjusts it in Admin.
 * Idempotent: existing docs are left untouched. Skips products that already exist as priced studio services.
 *   npx tsx functions/src/scripts/seed-brand-products.ts [tenantId]
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { Service } from "@autodeck/core";
import { FIRST_TENANT_ID } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { BRANDS } from "./brand-data.js";

if (!getApps().length) initializeApp();
const db = getFirestore();
const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main(tenantId: string) {
  const existing = await db.collection(COLLECTIONS.services()).get();
  const priced = new Set(existing.docs.map((d) => `${(d.data() as Service).brand ?? ""}|${(d.data() as Service).name}`.toLowerCase()));
  let created = 0;
  let skipped = 0;
  let order = 100;
  for (const b of BRANDS) {
    for (const it of b.items) {
      order++;
      const studioKey = `${b.name}|${b.name} ${it.name.replace(/ ppf$/i, "")}`.toLowerCase();
      const bare = `${b.name}|${it.name.replace(/ ppf$/i, "")}`.toLowerCase();
      const prolong = `${b.name}|${b.name} ${it.name}`.toLowerCase();
      if (priced.has(studioKey) || priced.has(bare) || priced.has(prolong) || [...priced].some((k) => k.startsWith(`${b.name.toLowerCase()}|`) && k.endsWith(`|${it.name.toLowerCase()}`))) { skipped++; continue; }
      const id = `svc-brand-${slug(b.name)}-${slug(it.name)}`;
      const ref = db.collection(COLLECTIONS.services()).doc(id);
      if ((await ref.get()).exists) { skipped++; continue; }
      const now = new Date().toISOString();
      const warranty = it.warranty ? it.warranty.split(" (")[0] ?? null : null;
      const svc: Service = {
        id, tenantId,
        name: `${b.name} ${it.name}`,
        category: it.kind === "PPF" ? "ppf" : "ceramic",
        brand: b.name,
        description: [it.note, `Range as stated on ${b.source}. Price quoted by the studio.`].filter(Boolean).join(" "),
        basePrice: 0,
        currency: "INR",
        estimatedDurationMinutes: 480,
        warrantyLabel: warranty,
        warrantyDurationValue: null,
        warrantyDurationUnit: null,
        vehicleCategoryPricing: [],
        requiredBayType: "protection",
        membershipWashEligible: false,
        priceOnRequest: true,
        active: true,
        displayOrder: order,
        createdAt: now,
        updatedAt: now,
      };
      await ref.set(svc);
      created++;
      console.warn(`created ${id}`);
    }
  }
  console.warn(`Done. ${created} created, ${skipped} skipped.`);
}
void main(process.argv[2] ?? FIRST_TENANT_ID).catch((e) => { console.error(e); process.exit(1); });
